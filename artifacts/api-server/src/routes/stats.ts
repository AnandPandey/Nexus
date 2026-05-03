import { Router } from "express";
import { db } from "@workspace/db";
import { pagesTable, termsTable, searchLogsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { GetTopQueriesQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const [pageCounts] = await db
    .select({
      total: sql<number>`count(*)`,
      indexed: sql<number>`count(*) filter (where status = 'indexed')`,
      pending: sql<number>`count(*) filter (where status = 'pending')`,
      failed: sql<number>`count(*) filter (where status = 'failed')`,
    })
    .from(pagesTable);

  const [searchCounts] = await db
    .select({ total: sql<number>`count(*)` })
    .from(searchLogsTable);

  const [termCounts] = await db
    .select({ total: sql<number>`count(*)` })
    .from(termsTable);

  const [avgResults] = await db
    .select({ avg: sql<number>`avg(results_count)` })
    .from(searchLogsTable);

  const [lastIndexed] = await db
    .select({ indexedAt: pagesTable.indexedAt })
    .from(pagesTable)
    .where(eq(pagesTable.status, "indexed"))
    .orderBy(desc(pagesTable.indexedAt))
    .limit(1);

  return res.json({
    totalPages: Number(pageCounts.total),
    indexedPages: Number(pageCounts.indexed),
    pendingPages: Number(pageCounts.pending),
    failedPages: Number(pageCounts.failed),
    totalSearches: Number(searchCounts.total),
    totalTerms: Number(termCounts.total),
    avgResultsPerSearch: Number(avgResults.avg ?? 0),
    lastIndexedAt: lastIndexed?.indexedAt?.toISOString(),
  });
});

router.get("/top-queries", async (req, res) => {
  const parsed = GetTopQueriesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  const { limit } = parsed.data;

  const queries = await db
    .select({
      query: searchLogsTable.query,
      count: sql<number>`count(*)`,
    })
    .from(searchLogsTable)
    .groupBy(searchLogsTable.query)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return res.json({
    queries: queries.map((q) => ({ query: q.query, count: Number(q.count) })),
  });
});

export default router;
