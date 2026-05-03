import { Router } from "express";
import { db } from "@workspace/db";
import { pagesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { SubmitUrlBody, ListIndexedPagesQueryParams, DeleteIndexedPageParams } from "@workspace/api-zod";
import { extractDomain, indexPage } from "../lib/indexer.js";
import { fetchPage } from "../lib/crawler.js";

const router = Router();

router.post("/submit", async (req, res) => {
  const parsed = SubmitUrlBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
  }

  const { url, title, description, content } = parsed.data;
  const domain = extractDomain(url);

  const existing = await db
    .select({ id: pagesTable.id })
    .from(pagesTable)
    .where(eq(pagesTable.url, url));

  let pageId: number;

  if (existing.length > 0) {
    pageId = existing[0].id;
    await db
      .update(pagesTable)
      .set({
        title: title ?? "",
        description: description ?? "",
        content: content ?? "",
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(pagesTable.id, pageId));
  } else {
    const [inserted] = await db
      .insert(pagesTable)
      .values({
        url,
        title: title ?? url,
        description: description ?? "",
        content: content ?? "",
        domain,
        status: "pending",
      })
      .returning({ id: pagesTable.id });
    pageId = inserted.id;
  }

  // Fetch page metadata (images, page type, etc.) and re-index in background
  const doFullIndex = async () => {
    try {
      // If no content provided, fetch the page to extract rich metadata
      if (!content) {
        const fetched = await fetchPage(url);
        if (fetched) {
          await db
            .update(pagesTable)
            .set({
              title: fetched.title || title || url,
              description: fetched.description || description || "",
              content: fetched.content,
              images: JSON.stringify(fetched.images),
              thumbnail: fetched.thumbnail,
              pageType: fetched.pageType,
              publishedAt: fetched.publishedAt ?? undefined,
              author: fetched.author,
              updatedAt: new Date(),
            })
            .where(eq(pagesTable.id, pageId));
        }
      }
      await indexPage(pageId);
    } catch (err: any) {
      req.log?.error({ err, pageId }, "Indexing failed");
      db.update(pagesTable)
        .set({ status: "failed" })
        .where(eq(pagesTable.id, pageId))
        .catch(() => {});
    }
  };

  doFullIndex();

  const [page] = await db.select().from(pagesTable).where(eq(pagesTable.id, pageId));

  return res.status(201).json({
    id: page.id,
    url: page.url,
    title: page.title,
    description: page.description,
    domain: page.domain,
    status: page.status,
    wordCount: page.wordCount,
    indexedAt: page.indexedAt?.toISOString(),
    createdAt: page.createdAt.toISOString(),
  });
});

router.get("/pages", async (req, res) => {
  const parsed = ListIndexedPagesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid parameters" });
  }

  const { page, limit, status } = parsed.data;
  const offset = (page - 1) * limit;

  const whereClause =
    status === "all" ? undefined : eq(pagesTable.status, status as "pending" | "indexed" | "failed");

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(pagesTable)
    .where(whereClause);

  const total = Number(countResult.count);

  const pages = await db
    .select()
    .from(pagesTable)
    .where(whereClause)
    .orderBy(pagesTable.createdAt)
    .limit(limit)
    .offset(offset);

  return res.json({
    pages: pages.map((p) => ({
      id: p.id,
      url: p.url,
      title: p.title,
      description: p.description,
      domain: p.domain,
      status: p.status,
      wordCount: p.wordCount,
      indexedAt: p.indexedAt?.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
});

router.delete("/pages/:id", async (req, res) => {
  const parsed = DeleteIndexedPageParams.safeParse(req.params);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const { id } = parsed.data;

  const existing = await db
    .select({ id: pagesTable.id })
    .from(pagesTable)
    .where(eq(pagesTable.id, id));

  if (existing.length === 0) {
    return res.status(404).json({ success: false, message: "Page not found" });
  }

  await db.delete(pagesTable).where(eq(pagesTable.id, id));

  return res.json({ success: true, message: "Page removed from index" });
});

export default router;
