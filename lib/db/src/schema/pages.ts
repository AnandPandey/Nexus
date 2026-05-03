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
    // Rich metadata
    pageType: text("page_type", { enum: ["web", "news", "image"] }).default("web").notNull(),
    images: text("images").default("[]"),       // JSON array of { url, alt, width, height }
    thumbnail: text("thumbnail").default(""),   // Best single image for this page
    publishedAt: timestamp("published_at"),     // For news articles
    author: text("author").default(""),
    // Timestamps
    indexedAt: timestamp("indexed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pages_status_idx").on(table.status),
    index("pages_domain_idx").on(table.domain),
    index("pages_type_idx").on(table.pageType),
    index("pages_published_idx").on(table.publishedAt),
  ]
);

export const insertPageSchema = createInsertSchema(pagesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPage = z.infer<typeof insertPageSchema>;
export type Page = typeof pagesTable.$inferSelect;
