import { Router } from "express";
import { db } from "@workspace/db";
import { pagesTable, termsTable, termPostingsTable, searchLogsTable } from "@workspace/db";
import { eq, inArray, desc, and, sql } from "drizzle-orm";
import { SearchQueryParams, GetSearchSuggestionsQueryParams } from "@workspace/api-zod";
import { tokenize, computeTFIDF } from "../lib/indexer.js";

const router = Router();

router.get("/", async (req, res) => {
  const start = Date.now();
  const parsed = SearchQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid query parameters" });
  }

  const { q, page, limit, type } = parsed.data;
  const offset = (page - 1) * limit;

  const queryTokens = tokenize(q);
  const emptyResult = { results: [], total: 0, page, limit, totalPages: 0, query: q, timeTakenMs: Date.now() - start };

  if (queryTokens.length === 0) {
    await db.insert(searchLogsTable).values({ query: q, resultsCount: 0 });
    return res.json(emptyResult);
  }

  // For "images" type, search pages that have thumbnails
  const typeFilter =
    type === "web" ? eq(pagesTable.pageType, "web") :
    type === "news" ? eq(pagesTable.pageType, "news") :
    type === "images" ? sql`${pagesTable.thumbnail} != ''` :
    undefined;

  const totalDocsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(pagesTable)
    .where(typeFilter ? and(eq(pagesTable.status, "indexed"), typeFilter) : eq(pagesTable.status, "indexed"));
  const totalDocs = Number(totalDocsResult[0]?.count ?? 1);

  const matchedTerms = await db
    .select()
    .from(termsTable)
    .where(inArray(termsTable.term, queryTokens));

  if (matchedTerms.length === 0) {
    await db.insert(searchLogsTable).values({ query: q, resultsCount: 0 });
    return res.json(emptyResult);
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
    return res.json(emptyResult);
  }

  // Get all candidate page IDs and fetch with type filter
  const candidateIds = [...pageScores.keys()];
  const whereClause = typeFilter
    ? and(inArray(pagesTable.id, candidateIds), typeFilter, eq(pagesTable.status, "indexed"))
    : and(inArray(pagesTable.id, candidateIds), eq(pagesTable.status, "indexed"));

  const pages = await db.select().from(pagesTable).where(whereClause);

  // Sort by TF-IDF score; for news, also boost recent articles
  const pageMap = new Map(pages.map((p) => [p.id, p]));
  const scoredPages = pages.map((p) => {
    let score = pageScores.get(p.id) ?? 0;
    // Boost news articles by recency
    if (type === "news" && p.publishedAt) {
      const ageMs = Date.now() - p.publishedAt.getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      score += Math.max(0, 2 - ageDays / 30); // bonus decays over 60 days
    }
    return { page: p, score };
  });

  scoredPages.sort((a, b) => b.score - a.score);

  const total = scoredPages.length;
  const paginatedPages = scoredPages.slice(offset, offset + limit);

  const results = paginatedPages.map(({ page: p, score }) => {
    let images: Array<{ url: string; alt: string }> = [];
    try { images = JSON.parse(p.images ?? "[]"); } catch {}

    return {
      id: p.id,
      url: p.url,
      title: p.title,
      description: p.description ?? "",
      score,
      domain: p.domain,
      indexedAt: p.indexedAt?.toISOString() ?? p.createdAt.toISOString(),
      favicon: `https://www.google.com/s2/favicons?domain=${p.domain}&sz=32`,
      wordCount: p.wordCount ?? 0,
      pageType: p.pageType,
      thumbnail: p.thumbnail ?? "",
      images,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      author: p.author ?? "",
    };
  });

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
    if (!seen.has(r.query)) { seen.add(r.query); suggestions.push(r.query); }
  }
  for (const r of termMatches) {
    if (!seen.has(r.term) && suggestions.length < 8) { seen.add(r.term); suggestions.push(r.term); }
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
