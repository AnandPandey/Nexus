#!/usr/bin/env python3
"""
main.py — CLI for the Python search engine

Usage:
  python main.py crawl  <seed_url> [--max 50] [--db search.db]
  python main.py index  [--db search.db]
  python main.py serve  [--db search.db] [--port 5000]
  python main.py run    <seed_url> [--max 50] [--db search.db] [--port 5000]
                                    (crawl + index + serve in one command)
  python main.py query  <query_string> [--db search.db] [--n 10]
"""
import argparse
import sys


def cmd_crawl(args):
    from crawler import crawl
    crawl(args.seed, db_path=args.db, max_pages=args.max)


def cmd_index(args):
    from indexer import build_index
    build_index(db_path=args.db)


def cmd_serve(args):
    import app as search_app
    search_app.DB_PATH = args.db
    print(f"\n  Search UI → http://localhost:{args.port}/\n")
    search_app.app.run(debug=False, port=args.port)


def cmd_query(args):
    import app as search_app
    search_app.DB_PATH = args.db
    result = search_app.search(args.query, n=args.n)
    if not result["results"]:
        print("No results.")
        return
    print(f"\n{result['total']} result(s) in {result['elapsed_ms']:.1f} ms\n")
    for i, r in enumerate(result["results"], 1):
        print(f"[{i}] {r['title']}")
        print(f"    {r['url']}")
        print(f"    {r['snippet']}")
        print(f"    score: {r['score']:.4f}\n")


def main():
    parser = argparse.ArgumentParser(description="Python search engine")
    sub = parser.add_subparsers(dest="cmd")

    # crawl
    p_crawl = sub.add_parser("crawl", help="Crawl from a seed URL")
    p_crawl.add_argument("seed")
    p_crawl.add_argument("--max", type=int, default=50)
    p_crawl.add_argument("--db", default="search.db")

    # index
    p_index = sub.add_parser("index", help="Build the inverted index")
    p_index.add_argument("--db", default="search.db")

    # serve
    p_serve = sub.add_parser("serve", help="Start the Flask search UI")
    p_serve.add_argument("--db", default="search.db")
    p_serve.add_argument("--port", type=int, default=5000)

    # run (all-in-one)
    p_run = sub.add_parser("run", help="Crawl + index + serve")
    p_run.add_argument("seed")
    p_run.add_argument("--max", type=int, default=50)
    p_run.add_argument("--db", default="search.db")
    p_run.add_argument("--port", type=int, default=5000)

    # query (CLI search)
    p_query = sub.add_parser("query", help="Search from the command line")
    p_query.add_argument("query")
    p_query.add_argument("--db", default="search.db")
    p_query.add_argument("--n", type=int, default=10)

    args = parser.parse_args()

    if args.cmd == "crawl":
        cmd_crawl(args)
    elif args.cmd == "index":
        cmd_index(args)
    elif args.cmd == "serve":
        cmd_serve(args)
    elif args.cmd == "run":
        cmd_crawl(args)
        cmd_index(args)
        cmd_serve(args)
    elif args.cmd == "query":
        cmd_query(args)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
