"""
app.py — Flask search API + minimal web UI
"""
import os
import sqlite3
from collections import defaultdict
from flask import Flask, request, jsonify, render_template_string, send_from_directory
 
from indexer import tokenize
 
app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'frontend/dist'))
DB_PATH = "search.db"
 
# ─── HTML UI ──────────────────────────────────────────────────────────────────
 
UI_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nexus</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #222; }
 
    header { background: #fff; border-bottom: 1px solid #e0e0e0; padding: 16px 24px;
             display: flex; align-items: center; gap: 16px; }
    header h1 { font-size: 22px; font-weight: 600; color: #1a73e8; }
 
    .search-bar { display: flex; gap: 8px; flex: 1; max-width: 640px; }
    .search-bar input { flex: 1; padding: 10px 14px; border: 1px solid #ccc;
                        border-radius: 24px; font-size: 15px; outline: none; }
    .search-bar input:focus { border-color: #1a73e8; box-shadow: 0 0 0 2px #c6d9fb; }
    .search-bar button { padding: 10px 20px; background: #1a73e8; color: #fff;
                         border: none; border-radius: 24px; font-size: 14px;
                         cursor: pointer; font-weight: 500; }
    .search-bar button:hover { background: #1558b0; }
 
    main { max-width: 720px; margin: 32px auto; padding: 0 16px; }
    #stats { font-size: 13px; color: #777; margin-bottom: 20px; }
 
    .result { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px;
              padding: 16px 20px; margin-bottom: 12px; }
    .result .title a { font-size: 17px; font-weight: 500; color: #1a73e8;
                       text-decoration: none; display: block; margin-bottom: 4px; }
    .result .title a:hover { text-decoration: underline; }
    .result .url { font-size: 12px; color: #0a6d0a; margin-bottom: 6px;
                   overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .result .snippet { font-size: 14px; color: #444; line-height: 1.5; }
    .result .score { font-size: 11px; color: #aaa; margin-top: 6px; }
 
    #no-results { color: #888; text-align: center; margin-top: 48px; font-size: 16px; }
    .spinner { display: none; text-align: center; margin: 40px; color: #888; }
  </style>
</head>
<body>
 
<header>
  <h1>&#128269; Nexus</h1>
  <form class="search-bar" onsubmit="doSearch(event)">
    <input id="q" type="search" placeholder="Search crawled pages…" autofocus>
    <button type="submit">Search</button>
  </form>
</header>
 
<main>
  <div id="stats"></div>
  <div id="results"></div>
  <div class="spinner" id="spinner">Searching…</div>
</main>
 
<script>
async function doSearch(e) {
  e && e.preventDefault();
  const q = document.getElementById('q').value.trim();
  if (!q) return;
  document.getElementById('results').innerHTML = '';
  document.getElementById('stats').textContent = '';
  document.getElementById('spinner').style.display = 'block';
 
  const resp = await fetch('/search?q=' + encodeURIComponent(q) + '&n=10');
  const data = await resp.json();
  document.getElementById('spinner').style.display = 'none';
 
  const container = document.getElementById('results');
 
  if (!data.results || data.results.length === 0) {
    container.innerHTML = '<div id="no-results">No results found for <strong>' + escHtml(q) + '</strong></div>';
    return;
  }
 
  document.getElementById('stats').textContent =
    data.total + ' result' + (data.total !== 1 ? 's' : '') +
    ' (' + data.elapsed_ms.toFixed(1) + ' ms)';
 
  container.innerHTML = data.results.map(r => `
    <div class="result">
      <div class="title"><a href="${escHtml(r.url)}" target="_blank">${escHtml(r.title || r.url)}</a></div>
      <div class="url">${escHtml(r.url)}</div>
      <div class="snippet">${escHtml(r.snippet)}</div>
      <div class="score">Score: ${r.score.toFixed(4)}</div>
    </div>
  `).join('');
}
 
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
 
// Allow pressing Enter in the search box
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  if (params.get('q')) {
    document.getElementById('q').value = params.get('q');
    doSearch();
  }
});
</script>
</body>
</html>
"""
 
# ─── Search logic ─────────────────────────────────────────────────────────────
 
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
 
 
def snippet(body: str, query_tokens: list[str], length: int = 200) -> str:
    """Extract a relevant snippet around the first query term hit."""
    if not body:
        return ""
    lower = body.lower()
    best_pos = len(body)
    for t in query_tokens:
        pos = lower.find(t)
        if 0 <= pos < best_pos:
            best_pos = pos
    start = max(0, best_pos - 80)
    end = min(len(body), start + length)
    chunk = body[start:end].strip()
    if start > 0:
        chunk = "…" + chunk
    if end < len(body):
        chunk = chunk + "…"
    return chunk
 
 
def search(query: str, n: int = 10) -> dict:
    import time
    t0 = time.perf_counter()
    tokens = tokenize(query)
    if not tokens:
        return {"results": [], "total": 0, "elapsed_ms": 0.0}
 
    conn = get_db()
 
    # BM25 scores summed across query terms
    bm25_scores: dict[int, float] = defaultdict(float)
    placeholders = ",".join("?" * len(tokens))
    rows = conn.execute(
        f"SELECT term, doc_id, bm25 FROM postings WHERE term IN ({placeholders})",
        tokens,
    ).fetchall()
    for row in rows:
        bm25_scores[row["doc_id"]] += row["bm25"]
 
    if not bm25_scores:
        conn.close()
        return {"results": [], "total": 0, "elapsed_ms": (time.perf_counter() - t0) * 1000}
 
    # PageRank scores (default 0 if not computed yet)
    PR_ALPHA = 5.0
    doc_ids = list(bm25_scores.keys())
    ph = ",".join("?" * len(doc_ids))
    pr_rows = conn.execute(
        f"SELECT doc_id, score FROM pagerank WHERE doc_id IN ({ph})", doc_ids
    ).fetchall()
    pr = {r["doc_id"]: r["score"] for r in pr_rows}
 
    # Combined score: BM25 × (1 + alpha × PageRank)
    combined: dict[int, float] = {
        doc_id: bm25 * (1 + PR_ALPHA * pr.get(doc_id, 0.0))
        for doc_id, bm25 in bm25_scores.items()
    }
 
    top_ids = sorted(combined, key=lambda d: combined[d], reverse=True)[:n]
    placeholders2 = ",".join("?" * len(top_ids))
    pages = conn.execute(
        f"SELECT id, url, title, body FROM pages WHERE id IN ({placeholders2})", top_ids
    ).fetchall()
    conn.close()
 
    page_map = {p["id"]: p for p in pages}
    results = []
    for doc_id in top_ids:
        if doc_id not in page_map:
            continue
        p = page_map[doc_id]
        results.append({
            "url":      p["url"],
            "title":    p["title"] or p["url"],
            "snippet":  snippet(p["body"], tokens),
            "score":    combined[doc_id],
            "bm25":     round(bm25_scores[doc_id], 4),
            "pagerank": round(pr.get(doc_id, 0.0), 4),
        })
 
    elapsed = (time.perf_counter() - t0) * 1000
    return {"results": results, "total": len(results), "elapsed_ms": elapsed}
 
 
# ─── Routes ───────────────────────────────────────────────────────────────────
 
@app.route("/")
def index():
    return render_template_string(UI_HTML)
 
 
@app.route("/search")
def search_route():
    q = request.args.get("q", "").strip()
    n = min(int(request.args.get("n", 10)), 50)
    if not q:
        return jsonify({"error": "Missing query parameter 'q'"}), 400
    return jsonify(search(q, n))
 
 
@app.route("/stats")
def stats_route():
    conn = get_db()
    pages = conn.execute("SELECT COUNT(*) FROM pages").fetchone()[0]
    terms = conn.execute("SELECT COUNT(*) FROM index_terms").fetchone()[0]
    postings = conn.execute("SELECT COUNT(*) FROM postings").fetchone()[0]
    conn.close()
    return jsonify({"pages": pages, "terms": terms, "postings": postings})
 
 
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')


if __name__ == "__main__":
    app.run(debug=True, port=5000)