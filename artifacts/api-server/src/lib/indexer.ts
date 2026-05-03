import { db } from "@workspace/db";
import { pagesTable, termsTable, termPostingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "was", "are", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "dare",
  "ought", "used", "it", "its", "this", "that", "these", "those", "i",
  "me", "my", "we", "our", "you", "your", "he", "she", "him", "her",
  "they", "them", "their", "what", "which", "who", "whom", "when",
  "where", "why", "how", "all", "both", "each", "few", "more", "most",
  "other", "some", "such", "no", "not", "only", "same", "so", "than",
  "too", "very", "s", "t", "just", "don", "about", "as", "into",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

export function computeTF(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  const total = tokens.length || 1;
  const tf = new Map<string, number>();
  for (const [term, count] of freq) {
    tf.set(term, count / total);
  }
  return tf;
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export async function indexPage(pageId: number): Promise<void> {
  const [page] = await db
    .select()
    .from(pagesTable)
    .where(eq(pagesTable.id, pageId));

  if (!page) return;

  const fullText = `${page.title} ${page.title} ${page.description} ${page.content}`;
  const tokens = tokenize(fullText);
  const tf = computeTF(tokens);
  const wordCount = tokens.length;

  for (const [term, termFreq] of tf) {
    let termId: number;

    const existing = await db
      .select({ id: termsTable.id })
      .from(termsTable)
      .where(eq(termsTable.term, term));

    if (existing.length > 0) {
      termId = existing[0].id;
      await db
        .update(termsTable)
        .set({ documentFrequency: sql`${termsTable.documentFrequency} + 1` })
        .where(eq(termsTable.id, termId));
    } else {
      const [inserted] = await db
        .insert(termsTable)
        .values({ term, documentFrequency: 1 })
        .returning({ id: termsTable.id });
      termId = inserted.id;
    }

    await db
      .insert(termPostingsTable)
      .values({ termId, pageId, termFrequency: termFreq })
      .onConflictDoNothing();
  }

  await db
    .update(pagesTable)
    .set({
      status: "indexed",
      wordCount,
      indexedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pagesTable.id, pageId));
}

export async function computeTFIDF(
  termFreq: number,
  documentFrequency: number,
  totalDocs: number
): Promise<number> {
  const idf = Math.log((totalDocs + 1) / (documentFrequency + 1)) + 1;
  return termFreq * idf;
}
