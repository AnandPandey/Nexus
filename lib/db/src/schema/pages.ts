import { pgTable, text, serial, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pagesTable = pgTable(
  "pages",
  {
    id: serial("id").primaryKey(),
    url: text("url").notNull().unique(),
    title: text("title").notNull().default(""),
    description: text("description").default(""),
    content: text("content").default(""),
    domain: text("domain").notNull().default(""),
    favicon: text("favicon").default(""),
    wordCount: integer("word_count").default(0),
    status: text("status", { enum: ["pending", "indexed", "failed"] })
      .notNull()
      .default("pending"),
    pageRank: real("page_rank").default(1.0),
    indexedAt: timestamp("indexed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pages_status_idx").on(table.status),
    index("pages_domain_idx").on(table.domain),
  ]
);

export const insertPageSchema = createInsertSchema(pagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pagesTable.$inferSelect;
