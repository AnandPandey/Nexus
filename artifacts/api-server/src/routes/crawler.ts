import { Router } from "express";
import { db } from "@workspace/db";
import { crawlSessionsTable, crawlQueueTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { startCrawlSession, isSessionActive } from "../lib/crawler.js";

const router = Router();

router.post("/start", async (req, res) => {
  const { seedUrl, maxDepth = 2, maxPages = 30 } = req.body ?? {};

  if (!seedUrl || typeof seedUrl !== "string") {
    return res.status(400).json({ error: "seedUrl is required" });
  }

  try {
    new URL(seedUrl);
  } catch {
    return res.status(400).json({ error: "Invalid seedUrl" });
  }

  const [session] = await db
    .insert(crawlSessionsTable)
    .values({
      seedUrl,
      maxDepth: Math.min(Number(maxDepth) || 2, 3),
      maxPages: Math.min(Number(maxPages) || 30, 100),
      status: "running",
    })
    .returning();

  await db.insert(crawlQueueTable).values({
    sessionId: session.id,
    url: seedUrl,
    depth: 0,
    status: "pending",
  });

  startCrawlSession(session.id).catch((err) => {
    req.log?.error({ err, sessionId: session.id }, "Crawl session error");
  });

  return res.status(201).json(formatSession(session));
});

router.post("/stop/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid session id" });

  const [session] = await db
    .select()
    .from(crawlSessionsTable)
    .where(eq(crawlSessionsTable.id, id));

  if (!session) return res.status(404).json({ error: "Session not found" });

  await db
    .update(crawlSessionsTable)
    .set({ status: "stopped", completedAt: new Date() })
    .where(eq(crawlSessionsTable.id, id));

  const [updated] = await db
    .select()
    .from(crawlSessionsTable)
    .where(eq(crawlSessionsTable.id, id));

  return res.json(formatSession(updated));
});

router.get("/sessions", async (req, res) => {
  const sessions = await db
    .select()
    .from(crawlSessionsTable)
    .orderBy(desc(crawlSessionsTable.startedAt))
    .limit(20);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crawlSessionsTable);

  return res.json({
    sessions: sessions.map(formatSession),
    total: Number(countResult.count),
  });
});

router.get("/sessions/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [session] = await db
    .select()
    .from(crawlSessionsTable)
    .where(eq(crawlSessionsTable.id, id));

  if (!session) return res.status(404).json({ error: "Session not found" });

  return res.json(formatSession(session));
});

router.get("/sessions/:id/queue", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10), 100);
  const offset = parseInt(String(req.query.offset ?? "0"), 10);

  const items = await db
    .select()
    .from(crawlQueueTable)
    .where(eq(crawlQueueTable.sessionId, id))
    .orderBy(crawlQueueTable.createdAt)
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(crawlQueueTable)
    .where(eq(crawlQueueTable.sessionId, id));

  return res.json({
    items: items.map(formatQueueItem),
    total: Number(countResult.count),
  });
});

function formatSession(s: typeof crawlSessionsTable.$inferSelect) {
  return {
    id: s.id,
    seedUrl: s.seedUrl,
    maxDepth: s.maxDepth,
    maxPages: s.maxPages,
    pagesFound: s.pagesFound,
    pagesIndexed: s.pagesIndexed,
    pagesFailed: s.pagesFailed,
    status: s.status,
    error: s.error,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString(),
    isActive: isSessionActive(s.id),
  };
}

function formatQueueItem(q: typeof crawlQueueTable.$inferSelect) {
  return {
    id: q.id,
    sessionId: q.sessionId,
    url: q.url,
    depth: q.depth,
    status: q.status,
    parentUrl: q.parentUrl,
    error: q.error,
    createdAt: q.createdAt.toISOString(),
    processedAt: q.processedAt?.toISOString(),
  };
}

export default router;
