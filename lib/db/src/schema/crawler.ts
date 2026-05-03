import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const crawlSessionsTable = pgTable("crawl_sessions", {
  id: serial("id").primaryKey(),
  seedUrl: text("seed_url").notNull(),
  maxDepth: integer("max_depth").default(2).notNull(),
  maxPages: integer("max_pages").default(50).notNull(),
  pagesFound: integer("pages_found").default(0).notNull(),
  pagesIndexed: integer("pages_indexed").default(0).notNull(),
  pagesFailed: integer("pages_failed").default(0).notNull(),
  status: text("status", { enum: ["running", "completed", "stopped", "failed"] })
    .default("running")
    .notNull(),
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const crawlQueueTable = pgTable(
  "crawl_queue",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id").notNull(),
    url: text("url").notNull(),
    depth: integer("depth").default(0).notNull(),
    status: text("status", { enum: ["pending", "processing", "done", "failed", "skipped"] })
      .default("pending")
      .notNull(),
    parentUrl: text("parent_url"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => [
    index("crawl_queue_session_idx").on(table.sessionId),
    index("crawl_queue_status_idx").on(table.status),
    index("crawl_queue_url_idx").on(table.url),
  ]
);

export const insertCrawlSessionSchema = createInsertSchema(crawlSessionsTable).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});
export type InsertCrawlSession = z.infer<typeof insertCrawlSessionSchema>;
export type CrawlSession = typeof crawlSessionsTable.$inferSelect;

export const insertCrawlQueueSchema = createInsertSchema(crawlQueueTable).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});
export type InsertCrawlQueue = z.infer<typeof insertCrawlQueueSchema>;
export type CrawlQueue = typeof crawlQueueTable.$inferSelect;
