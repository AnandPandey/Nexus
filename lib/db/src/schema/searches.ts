import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const searchLogsTable = pgTable(
  "search_logs",
  {
    id: serial("id").primaryKey(),
    query: text("query").notNull(),
    resultsCount: integer("results_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("search_logs_query_idx").on(table.query)]
);

export const insertSearchLogSchema = createInsertSchema(searchLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSearchLog = z.infer<typeof insertSearchLogSchema>;
export type SearchLog = typeof searchLogsTable.$inferSelect;
