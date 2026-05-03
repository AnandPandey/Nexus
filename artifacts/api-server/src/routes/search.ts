import { Router } from "express";
import { db } from "@workspace/db";
import { pagesTable, termsTable, termPostingsTable, searchLogsTable } from "@workspace/db";
import { eq, inArray, desc, sql } from "drizzle-orm";
import { SearchQueryParams, GetSearchSuggestionsQueryParams, GetTopQueriesQueryParams } from "@workspace/api-zod";
import { tokenize, computeTFIDF } from "../lib/indexer.js";

const router = Router();

router.get("/", async (req, res) => {
  const start = Date.now();
  const parsed = SearchQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters" });
  }

  const { q, page, limit } = parsed.data;
  const offset = (page - 1) * limit;

  const queryTokens = tokenize(q);

  if (queryTokens.length === 0) {
    await db.insert(searchLogsTable).values({ query: q, resultsCount: 0 });
    return res.json({
      results: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      query: q,
      timeTakenMs: Date.now() - start,
    });
  }

  const totalDocsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(pagesTable)
    .where(eq(pagesTable.status, "indexed"));
  const totalDocs = Number(totalDocsResult[0]?.count ?? 1);

  const matchedTerms = await db
    .select()
    .from(termsTable)
    .where(inArray(termsTable.term, queryTokens));

  if (matchedTerms.length === 0) {
    await db.insert(searchLogsTable).values({ query: q, resultsCount: 0 });
    return res.json({
      results: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      query: q,
      timeTakenMs: Date.now() - start,
    });
  }

  const termIds = matchedTerms.map((t) => t.id);
  const postings = await db
    .select()
    .from(termPostingsTable)
    .where(inArray(termPostingsTable.termId, termIds));

  const termDFMap = new Map(matchedTerms.map((t) => [t.id, t.documentFrequency]));

  const pageScores = new Map<number, number>();
  for (const posting of postings) {
    const df = termDFMap.get(posting.termId) ?? 1;
    const tfidf = await computeTFIDF(posting.termFrequency, df, totalDocs);
    pageScores.set(posting.pageId, (pageScores.get(posting.pageId) ?? 0) + tfidf);
  }

  if (pageScores.size === 0) {
    await db.insert(searchLogsTable).values({ query: q, resultsCount: 0 });
    return res.json({
      results: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      query: q,
      timeTakenMs: Date.now() - start,
    });
  }

  const sortedPageIds = [...pageScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const total = sortedPageIds.length;
  const paginatedIds = sortedPageIds.slice(offset, offset + limit);

  const pages = await db
    .select()
    .from(pagesTable)
    .where(inArray(pagesTable.id, paginatedIds));

  const pageMap = new Map(pages.map((p) => [p.id, p]));
  const results = paginatedIds
    .map((id) => {
      const p = pageMap.get(id);
      if (!p) return null;
      return {
        id: p.id,
        url: p.url,
        title: p.title,
        description: p.description ?? "",
        score: pageScores.get(id) ?? 0,
        domain: p.domain,
        indexedAt: p.indexedAt?.toISOString() ?? p.createdAt.toISOString(),
        favicon: p.favicon ?? `https://www.google.com/s2/favicons?domain=${p.domain}`,
        wordCount: p.wordCount ?? 0,
      };
    })
    .filter(Boolean);

  await db.insert(searchLogsTable).values({ query: q, resultsCount: total });

  return res.json({
    results,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    query: q,
    timeTakenMs: Date.now() - start,
  });
});

router.get("/suggestions", async (req, res) => {
  const parsed = GetSearchSuggestionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  const { q } = parsed.data;
  if (q.length < 2) {
    return res.json({ suggestions: [], query: q });
  }

  const termMatches = await db
    .select({ term: termsTable.term })
    .from(termsTable)
    .where(sql`${termsTable.term} LIKE ${q.toLowerCase() + "%"}`)
    .limit(8);

  const queryMatches = await db
    .select({ query: searchLogsTable.query })
    .from(searchLogsTable)
    .where(sql`lower(${searchLogsTable.query}) LIKE ${q.toLowerCase() + "%"}`)
    .groupBy(searchLogsTable.query)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const r of queryMatches) {
    if (!seen.has(r.query)) {
      seen.add(r.query);
      suggestions.push(r.query);
    }
  }

  for (const r of termMatches) {
    if (!seen.has(r.term) && suggestions.length < 8) {
      seen.add(r.term);
      suggestions.push(r.term);
    }
  }

  return res.json({ suggestions, query: q });
});

router.get("/trending", async (req, res) => {
  const trending = await db
    .select({ query: searchLogsTable.query })
    .from(searchLogsTable)
    .groupBy(searchLogsTable.query)
    .orderBy(desc(sql`count(*)`))
    .limit(8);

  return res.json({ trending: trending.map((r) => r.query) });
});

export default router;
