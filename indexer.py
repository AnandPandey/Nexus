"""
indexer.py — Tokenizer + TF-IDF inverted index builder
"""
import re
import math
import sqlite3
import logging
from collections import Counter, defaultdict

logging.basicConfig(level=logging.INFO, format="%(asctime)s [indexer] %(message)s")
log = logging.getLogger(__name__)

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
    text = text.lower()
    tokens = re.findall(r"[a-z][a-z0-9]*", text)
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]


def init_index_tables(conn: sqlite3.Connection):
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS index_terms (
            term     TEXT PRIMARY KEY,
            doc_freq INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS postings (
            term   TEXT,
            doc_id INTEGER,
            tf_idf REAL,
            PRIMARY KEY (term, doc_id)
        );
        CREATE INDEX IF NOT EXISTS idx_postings_term ON postings(term);
    """)
    conn.commit()


def build_index(db_path: str = "search.db"):
    conn = sqlite3.connect(db_path)
    init_index_tables(conn)

    pages = conn.execute("SELECT id, title, body FROM pages").fetchall()
    if not pages:
        log.warning("No pages to index.")
        conn.close()
        return

    N = len(pages)
    log.info(f"Indexing {N} pages…")

    # --- Pass 1: compute TF per doc and collect DF ---
    doc_term_tf: dict[int, Counter] = {}
    df: Counter = Counter()

    for doc_id, title, body in pages:
        text = (title or "") + " " + (body or "")
        tokens = tokenize(text)
        if not tokens:
            continue
        tf = Counter(tokens)
        total = sum(tf.values())
        # normalise TF
        doc_term_tf[doc_id] = {t: c / total for t, c in tf.items()}
        for term in tf:
            df[term] += 1

    # --- Pass 2: compute TF-IDF and write to DB ---
    conn.execute("DELETE FROM postings")
    conn.execute("DELETE FROM index_terms")

    postings_batch = []
    terms_batch = []

    for term, freq in df.items():
        idf = math.log((N + 1) / (freq + 1)) + 1  # smoothed IDF
        terms_batch.append((term, freq))
        for doc_id, tf_dict in doc_term_tf.items():
            if term in tf_dict:
                tf_idf = tf_dict[term] * idf
                postings_batch.append((term, doc_id, tf_idf))

    conn.executemany(
        "INSERT OR REPLACE INTO index_terms (term, doc_freq) VALUES (?, ?)", terms_batch
    )
    conn.executemany(
        "INSERT OR REPLACE INTO postings (term, doc_id, tf_idf) VALUES (?, ?, ?)",
        postings_batch,
    )
    conn.commit()
    conn.close()
    log.info(f"Index built: {len(terms_batch)} unique terms, {len(postings_batch)} postings.")


if __name__ == "__main__":
    import sys
    db = sys.argv[1] if len(sys.argv) > 1 else "search.db"
    build_index(db)