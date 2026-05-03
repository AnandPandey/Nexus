import { pgTable, text, serial, integer, index, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const termsTable = pgTable(
  "terms",
  {
    id: serial("id").primaryKey(),
    term: text("term").notNull().unique(),
    documentFrequency: integer("document_frequency").default(0).notNull(),
  },
  (table) => [index("terms_term_idx").on(table.term)]
);

export const termPostingsTable = pgTable(
  "term_postings",
  {
    id: serial("id").primaryKey(),
    termId: integer("term_id").notNull(),
    pageId: integer("page_id").notNull(),
    termFrequency: real("term_frequency").default(0).notNull(),
    positions: text("positions").default(""),
  },
  (table) => [
    index("postings_term_idx").on(table.termId),
    index("postings_page_idx").on(table.pageId),
  ]
);

export const insertTermSchema = createInsertSchema(termsTable).omit({ id: true });
export type InsertTerm = z.infer<typeof insertTermSchema>;
export type Term = typeof termsTable.$inferSelect;

export const insertPostingSchema = createInsertSchema(termPostingsTable).omit({ id: true });
export type InsertPosting = z.infer<typeof insertPostingSchema>;
export type TermPosting = typeof termPostingsTable.$inferSelect;
