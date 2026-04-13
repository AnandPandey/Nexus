"""
indexer.py — BM25 inverted index + PageRank scorer
 
BM25 parameters:
  k1 = 1.5  (term saturation — higher = more reward for repeated terms)
  b  = 0.75 (length normalisation — 1.0 = full normalisation, 0 = none)
 
PageRank:
  Damping factor d = 0.85, power iteration until convergence (or max 100 iters).
  Final score = bm25 * (1 + alpha * pagerank)   where alpha = 5.0
"""
import re
import math
import sqlite3
import logging
from collections import Counter
 
logging.basicConfig(level=logging.INFO, format="%(asctime)s [indexer] %(message)s")
log = logging.getLogger(__name__)
 
K1 = 1.5
B  = 0.75
DAMPING   = 0.85
MAX_ITER  = 100
TOL       = 1e-6
PR_ALPHA  = 5.0
 
STOPWORDS = {
    "a","an","the","and","or","but","in","on","at","to","for","of","with","by",
    "from","is","was","are","were","be","been","being","have","has","had","do",
    "does","did","will","would","could","should","may","might","shall","can",
    "not","no","nor","so","yet","both","either","neither","as","if","then",
    "than","too","very","just","it","its","this","that","these","those","i",
    "me","my","we","our","you","your","he","him","his","she","her","they",
    "them","their","what","which","who","whom","how","when","where","why",
}
 
 
def tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-z][a-z0-9]*", text.lower())
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]
 
 
def init_index_tables(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS index_terms (
            term      TEXT PRIMARY KEY,
            doc_freq  INTEGER DEFAULT 0,
            idf       REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS postings (
            term      TEXT,
            doc_id    INTEGER,
            bm25      REAL,
            PRIMARY KEY (term, doc_id)
        );
        CREATE TABLE IF NOT EXISTS pagerank (
            doc_id    INTEGER PRIMARY KEY,
            score     REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS links (
            src_id    INTEGER,
            dst_id    INTEGER,
            PRIMARY KEY (src_id, dst_id)
        );
        CREATE INDEX IF NOT EXISTS idx_postings_term ON postings(term);
        CREATE INDEX IF NOT EXISTS idx_links_dst    ON links(dst_id);
    """)
    conn.commit()
 
 
def build_bm25(conn: sqlite3.Connection):
    pages = conn.execute("SELECT id, title, body FROM pages").fetchall()
    N = len(pages)
    if N == 0:
        log.warning("No pages to index.")
        return
 
    log.info(f"BM25: indexing {N} pages...")
 
    doc_tokens: dict[int, list[str]] = {}
    for doc_id, title, body in pages:
        doc_tokens[doc_id] = tokenize((title or "") + " " + (body or ""))
 
    avg_dl = sum(len(t) for t in doc_tokens.values()) / N
 
    df: Counter = Counter()
    for tokens in doc_tokens.values():
        for term in set(tokens):
            df[term] += 1
 
    conn.execute("DELETE FROM postings")
    conn.execute("DELETE FROM index_terms")
 
    postings_batch = []
    terms_batch = []
 
    for term, freq in df.items():
        idf = math.log((N - freq + 0.5) / (freq + 0.5) + 1)
        terms_batch.append((term, freq, idf))
 
        for doc_id, tokens in doc_tokens.items():
            tf = tokens.count(term)
            if tf == 0:
                continue
            dl = len(tokens)
            numerator   = tf * (K1 + 1)
            denominator = tf + K1 * (1 - B + B * dl / avg_dl)
            bm25 = idf * numerator / denominator
            postings_batch.append((term, doc_id, bm25))
 
    conn.executemany(
        "INSERT OR REPLACE INTO index_terms (term, doc_freq, idf) VALUES (?,?,?)",
        terms_batch,
    )
    conn.executemany(
        "INSERT OR REPLACE INTO postings (term, doc_id, bm25) VALUES (?,?,?)",
        postings_batch,
    )
    conn.commit()
    log.info(f"BM25 done: {len(terms_batch)} terms, {len(postings_batch)} postings.")
 
 
def build_link_graph(conn: sqlite3.Connection):
    from urllib.parse import urljoin
    from bs4 import BeautifulSoup
 
    pages = conn.execute("SELECT id, url, html FROM pages").fetchall()
    url_to_id = {row[1]: row[0] for row in pages}
 
    conn.execute("DELETE FROM links")
    batch = []
 
    for src_id, src_url, html in pages:
        if not html:
            continue
        try:
            soup = BeautifulSoup(html, "html.parser")
        except Exception:
            continue
        seen = set()
        for tag in soup.find_all("a", href=True):
            href = tag["href"].strip()
            full = urljoin(src_url, href).split("?")[0].split("#")[0]
            dst_id = url_to_id.get(full)
            if dst_id and dst_id != src_id and dst_id not in seen:
                batch.append((src_id, dst_id))
                seen.add(dst_id)
 
    conn.executemany("INSERT OR IGNORE INTO links (src_id, dst_id) VALUES (?,?)", batch)
    conn.commit()
    log.info(f"Link graph: {len(batch)} edges among {len(pages)} pages.")
 
 
def compute_pagerank(conn: sqlite3.Connection):
    page_ids = [r[0] for r in conn.execute("SELECT id FROM pages").fetchall()]
    N = len(page_ids)
    if N == 0:
        return
 
    idx   = {pid: i for i, pid in enumerate(page_ids)}
    rank  = [1.0 / N] * N
 
    out_links: dict[int, list[int]] = {i: [] for i in range(N)}
    for src_id, dst_id in conn.execute("SELECT src_id, dst_id FROM links").fetchall():
        if src_id in idx and dst_id in idx:
            out_links[idx[src_id]].append(idx[dst_id])
 
    dangling_nodes = [i for i in range(N) if not out_links[i]]
 
    log.info(f"PageRank: {N} nodes, running up to {MAX_ITER} iterations...")
 
    for iteration in range(MAX_ITER):
        new_rank = [0.0] * N
        dangling_sum = sum(rank[i] for i in dangling_nodes)
        dangling_contrib = DAMPING * dangling_sum / N
 
        for i in range(N):
            for j in out_links[i]:
                new_rank[j] += DAMPING * rank[i] / len(out_links[i])
            new_rank[i] += dangling_contrib
 
        teleport = (1 - DAMPING) / N
        new_rank = [r + teleport for r in new_rank]
 
        delta = sum(abs(new_rank[i] - rank[i]) for i in range(N))
        rank = new_rank
 
        if delta < TOL:
            log.info(f"PageRank converged after {iteration + 1} iterations (delta={delta:.2e})")
            break
    else:
        log.info(f"PageRank hit max iterations ({MAX_ITER})")
 
    max_pr = max(rank) or 1.0
    norm   = [r / max_pr for r in rank]
 
    conn.execute("DELETE FROM pagerank")
    conn.executemany(
        "INSERT INTO pagerank (doc_id, score) VALUES (?,?)",
        [(page_ids[i], norm[i]) for i in range(N)],
    )
    conn.commit()
    log.info(f"PageRank stored. Top score: {max(norm):.4f}, mean: {sum(norm)/N:.4f}")
 
 
def build_index(db_path: str = "search.db"):
    conn = sqlite3.connect(db_path)
    init_index_tables(conn)
    build_bm25(conn)
    build_link_graph(conn)
    compute_pagerank(conn)
    conn.close()
 
 
if __name__ == "__main__":
    import sys
    build_index(sys.argv[1] if len(sys.argv) > 1 else "search.db")