import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { db } from "@workspace/db";
import {
  crawlSessionsTable,
  crawlQueueTable,
  pagesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { extractDomain, indexPage } from "./indexer.js";

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT =
  "NexusBot/1.0 (custom search engine crawler; +https://nexus.example.com/bot)";

const BLOCKED_EXTENSIONS = new Set([
  ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
  ".mp4", ".mp3", ".zip", ".gz", ".tar", ".exe", ".dmg",
  ".css", ".js", ".woff", ".woff2", ".ttf", ".eot",
]);

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const path = u.pathname.toLowerCase();
    if (BLOCKED_EXTENSIONS.has(path.slice(path.lastIndexOf(".")))) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(url: string, base: string): string | null {
  try {
    const resolved = new URL(url, base);
    resolved.hash = "";
    return resolved.toString();
  } catch {
    return null;
  }
}

function isAbsoluteImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function detectPageType(
  $: ReturnType<typeof cheerio.load>,
  url: string
): "web" | "news" {
  const ogType = $("meta[property='og:type']").attr("content") ?? "";
  const articleMeta = $("meta[property='article:published_time']").attr("content");
  const newsKeywords = $("meta[name='news_keywords']").attr("content");
  const schemaType = $("script[type='application/ld+json']").text();

  if (
    ogType.includes("article") ||
    articleMeta ||
    newsKeywords ||
    schemaType.includes('"NewsArticle"') ||
    schemaType.includes('"Article"') ||
    /\/(news|article|blog|post|story|press)\//i.test(url) ||
    /\/\d{4}\/\d{2}\/\d{2}\//.test(url)
  ) {
    return "news";
  }
  return "web";
}

function extractPublishedAt($: ReturnType<typeof cheerio.load>): Date | null {
  const candidates = [
    $("meta[property='article:published_time']").attr("content"),
    $("meta[name='publish-date']").attr("content"),
    $("meta[name='date']").attr("content"),
    $("time[datetime]").first().attr("datetime"),
    $("meta[property='og:updated_time']").attr("content"),
  ];

  for (const c of candidates) {
    if (c) {
      const d = new Date(c);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function extractImages(
  $: ReturnType<typeof cheerio.load>,
  baseUrl: string
): Array<{ url: string; alt: string }> {
  const images: Array<{ url: string; alt: string }> = [];
  const seen = new Set<string>();

  // og:image first (highest quality thumbnail)
  const ogImage = $("meta[property='og:image']").attr("content");
  if (ogImage) {
    const resolved = normalizeUrl(ogImage, baseUrl);
    if (resolved && isAbsoluteImageUrl(resolved) && !seen.has(resolved)) {
      seen.add(resolved);
      images.push({ url: resolved, alt: $("meta[property='og:image:alt']").attr("content") ?? "" });
    }
  }

  // Gather <img> tags, prefer larger ones
  $("img").each((_, el) => {
    const src = $(el).attr("src") ?? $(el).attr("data-src") ?? "";
    const alt = $(el).attr("alt") ?? "";
    if (!src || src.startsWith("data:")) return;
    const resolved = normalizeUrl(src, baseUrl);
    if (!resolved || !isAbsoluteImageUrl(resolved) || seen.has(resolved)) return;

    const ext = resolved.toLowerCase();
    if (ext.includes(".svg") || ext.includes(".gif") || ext.includes("icon") || ext.includes("logo")) return;

    seen.add(resolved);
    images.push({ url: resolved, alt });

    if (images.length >= 10) return false;
  });

  return images;
}

export async function fetchPage(url: string): Promise<{
  title: string;
  description: string;
  content: string;
  links: string[];
  images: Array<{ url: string; alt: string }>;
  thumbnail: string;
  pageType: "web" | "news";
  publishedAt: Date | null;
  author: string;
} | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      redirect: "follow",
      signal: controller.signal as any,
    });

    clearTimeout(timer);

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;
    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    $("script, style, [role=navigation]").remove();

    const title =
      $("meta[property='og:title']").attr("content") ||
      $("title").text().trim() ||
      $("h1").first().text().trim() ||
      url;

    const description =
      $("meta[name='description']").attr("content") ||
      $("meta[property='og:description']").attr("content") ||
      $("p").first().text().trim().slice(0, 300) ||
      "";

    const author =
      $("meta[name='author']").attr("content") ||
      $("meta[property='article:author']").attr("content") ||
      $("[rel='author']").first().text().trim() ||
      "";

    $("nav, footer, header, aside").remove();
    const content = $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000);

    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const normalized = normalizeUrl(href, url);
      if (normalized && isValidUrl(normalized)) {
        links.push(normalized);
      }
    });

    const images = extractImages($, url);
    const thumbnail = images.length > 0 ? images[0].url : "";
    const pageType = detectPageType($, url);
    const publishedAt = extractPublishedAt($);

    return { title, description, content, links, images, thumbnail, pageType, publishedAt, author };
  } catch {
    return null;
  }
}

const activeSessions = new Set<number>();

export async function startCrawlSession(sessionId: number): Promise<void> {
  if (activeSessions.has(sessionId)) return;
  activeSessions.add(sessionId);

  try {
    const [session] = await db
      .select()
      .from(crawlSessionsTable)
      .where(eq(crawlSessionsTable.id, sessionId));

    if (!session || session.status !== "running") {
      activeSessions.delete(sessionId);
      return;
    }

    const visitedUrls = new Set<string>();

    while (true) {
      const [session] = await db
        .select()
        .from(crawlSessionsTable)
        .where(eq(crawlSessionsTable.id, sessionId));

      if (!session || session.status !== "running") break;
      if (session.pagesIndexed >= session.maxPages) {
        await db
          .update(crawlSessionsTable)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(crawlSessionsTable.id, sessionId));
        break;
      }

      const [nextItem] = await db
        .select()
        .from(crawlQueueTable)
        .where(
          and(
            eq(crawlQueueTable.sessionId, sessionId),
            eq(crawlQueueTable.status, "pending")
          )
        )
        .limit(1);

      if (!nextItem) {
        await db
          .update(crawlSessionsTable)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(crawlSessionsTable.id, sessionId));
        break;
      }

      await db
        .update(crawlQueueTable)
        .set({ status: "processing", processedAt: new Date() })
        .where(eq(crawlQueueTable.id, nextItem.id));

      if (visitedUrls.has(nextItem.url)) {
        await db
          .update(crawlQueueTable)
          .set({ status: "skipped" })
          .where(eq(crawlQueueTable.id, nextItem.id));
        continue;
      }

      visitedUrls.add(nextItem.url);

      const pageData = await fetchPage(nextItem.url);

      if (!pageData) {
        await db
          .update(crawlQueueTable)
          .set({ status: "failed", error: "Failed to fetch or parse" })
          .where(eq(crawlQueueTable.id, nextItem.id));
        await db
          .update(crawlSessionsTable)
          .set({ pagesFailed: sql`${crawlSessionsTable.pagesFailed} + 1` })
          .where(eq(crawlSessionsTable.id, sessionId));
        continue;
      }

      const domain = extractDomain(nextItem.url);

      const existing = await db
        .select({ id: pagesTable.id })
        .from(pagesTable)
        .where(eq(pagesTable.url, nextItem.url));

      let pageId: number;
      if (existing.length > 0) {
        pageId = existing[0].id;
        await db
          .update(pagesTable)
          .set({
            title: pageData.title,
            description: pageData.description,
            content: pageData.content,
            images: JSON.stringify(pageData.images),
            thumbnail: pageData.thumbnail,
            pageType: pageData.pageType,
            publishedAt: pageData.publishedAt ?? undefined,
            author: pageData.author,
            status: "pending",
            updatedAt: new Date(),
          })
          .where(eq(pagesTable.id, pageId));
      } else {
        const [inserted] = await db
          .insert(pagesTable)
          .values({
            url: nextItem.url,
            title: pageData.title,
            description: pageData.description,
            content: pageData.content,
            domain,
            images: JSON.stringify(pageData.images),
            thumbnail: pageData.thumbnail,
            pageType: pageData.pageType,
            publishedAt: pageData.publishedAt ?? undefined,
            author: pageData.author,
            status: "pending",
          })
          .returning({ id: pagesTable.id });
        pageId = inserted.id;
      }

      await indexPage(pageId);

      await db
        .update(crawlQueueTable)
        .set({ status: "done" })
        .where(eq(crawlQueueTable.id, nextItem.id));

      await db
        .update(crawlSessionsTable)
        .set({
          pagesIndexed: sql`${crawlSessionsTable.pagesIndexed} + 1`,
          pagesFound: sql`${crawlSessionsTable.pagesFound} + 1`,
        })
        .where(eq(crawlSessionsTable.id, sessionId));

      if (nextItem.depth < session.maxDepth) {
        const newLinks = pageData.links
          .filter((l) => !visitedUrls.has(l))
          .slice(0, 20);

        for (const link of newLinks) {
          const alreadyQueued = await db
            .select({ id: crawlQueueTable.id })
            .from(crawlQueueTable)
            .where(
              and(
                eq(crawlQueueTable.sessionId, sessionId),
                eq(crawlQueueTable.url, link)
              )
            );

          if (alreadyQueued.length === 0) {
            await db.insert(crawlQueueTable).values({
              sessionId,
              url: link,
              depth: nextItem.depth + 1,
              parentUrl: nextItem.url,
              status: "pending",
            });
          }
        }
      }

      await new Promise((r) => setTimeout(r, 300));
    }
  } catch (err) {
    await db
      .update(crawlSessionsTable)
      .set({ status: "failed", error: String(err), completedAt: new Date() })
      .where(eq(crawlSessionsTable.id, sessionId));
  } finally {
    activeSessions.delete(sessionId);
  }
}

export function isSessionActive(sessionId: number): boolean {
  return activeSessions.has(sessionId);
}
