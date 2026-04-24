#!/usr/bin/env python3
"""
Aggregate Buffer feature requests into categories.

What it does
------------
- Scrapes Buffer suggestion boards with Playwright
- Extracts request title/body/metadata
- Embeds request text with sentence-transformers
- Clusters semantically similar requests
- Produces category summaries and counts

Outputs
-------
- buffer_requests_raw.csv
- buffer_requests_clustered.csv
- buffer_feature_clusters.json

Install
-------
pip install playwright pandas beautifulsoup4 sentence-transformers scikit-learn numpy
playwright install chromium

Usage
-----
python aggregate_buffer_requests.py

Optional env vars
-----------------
MAX_POSTS_PER_BOARD=200
HEADLESS=true
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from typing import Any, Iterable
from urllib.parse import urljoin, urlparse

import numpy as np
import pandas as pd
from bs4 import BeautifulSoup
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright
from sentence_transformers import SentenceTransformer
from sklearn.cluster import DBSCAN
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS


BASE_URL = "https://suggestions.buffer.com"
BOARD_URLS = [
    "https://suggestions.buffer.com/b/feature-suggestions",
    "https://suggestions.buffer.com/b/new-channel-requests",
    "https://suggestions.buffer.com/b/buffer-api",
]

HEADLESS = os.getenv("HEADLESS", "true").lower() != "false"
MAX_POSTS_PER_BOARD = int(os.getenv("MAX_POSTS_PER_BOARD", "200"))

STOPWORDS = set(ENGLISH_STOP_WORDS) | {
    "buffer", "feature", "request", "requests", "new", "would", "could",
    "please", "add", "support", "allow", "ability", "option", "like",
    "need", "want", "using", "use", "also", "get", "make", "can"
}


@dataclass
class RequestItem:
    board: str
    url: str
    slug: str
    title: str
    body: str
    status: str | None
    votes: int | None
    comments: int | None
    author: str | None
    created_at: str | None


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text


def safe_slug(url: str) -> str:
    path = urlparse(url).path.strip("/")
    return path.replace("/", "__") or "root"


def extract_int(text: str | None) -> int | None:
    if not text:
        return None
    m = re.search(r"(\d[\d,]*)", text)
    if not m:
        return None
    return int(m.group(1).replace(",", ""))


def keyword_label(texts: list[str], top_n: int = 4) -> str:
    tokens: list[str] = []
    for text in texts:
        for tok in re.findall(r"[a-zA-Z][a-zA-Z0-9\-_]{2,}", text.lower()):
            if tok not in STOPWORDS:
                tokens.append(tok)

    if not tokens:
        return "miscellaneous requests"

    counts = Counter(tokens)
    top = [word for word, _ in counts.most_common(top_n)]
    return " / ".join(top)


def compact_summary(title: str, body: str, max_len: int = 220) -> str:
    source = clean_text(f"{title}. {body}")
    if len(source) <= max_len:
        return source
    cut = source[:max_len].rsplit(" ", 1)[0]
    return cut + "..."


async def auto_scroll(page, rounds: int = 25, pause_ms: int = 1200) -> None:
    last_height = 0
    stable_rounds = 0

    for _ in range(rounds):
        height = await page.evaluate("document.body.scrollHeight")
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(pause_ms)

        new_height = await page.evaluate("document.body.scrollHeight")
        if new_height == last_height:
            stable_rounds += 1
        else:
            stable_rounds = 0

        last_height = new_height
        if stable_rounds >= 3:
            break


async def collect_post_links(page, board_url: str, max_posts: int) -> list[str]:
    await page.goto(board_url, wait_until="domcontentloaded", timeout=90000)
    await page.wait_for_timeout(2500)
    await auto_scroll(page)

    hrefs: list[str] = await page.evaluate(
        """
        () => {
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          const urls = [];
          for (const a of anchors) {
            const href = a.getAttribute('href') || '';
            const text = (a.textContent || '').trim();
            if (!href) continue;

            const absolute = href.startsWith('http') ? href : new URL(href, location.origin).href;

            // Heuristics:
            // - same host
            // - not nav pages
            // - usually individual post pages are not /b/... or /about
            if (!absolute.startsWith(location.origin)) continue;
            if (absolute.includes('/b/')) continue;
            if (absolute.includes('/roadmap')) continue;
            if (absolute.includes('/whats-new')) continue;
            if (absolute === location.href) continue;
            if (!text) continue;

            urls.push(absolute);
          }
          return [...new Set(urls)];
        }
        """
    )

    # Fallback: use visible cards/articles if anchors are not enough.
    if not hrefs:
        hrefs = await page.evaluate(
            """
            () => {
              const nodes = Array.from(document.querySelectorAll('[role="link"], article a[href], li a[href]'));
              const urls = [];
              for (const n of nodes) {
                const href = n.getAttribute('href') || '';
                if (!href) continue;
                const absolute = href.startsWith('http') ? href : new URL(href, location.origin).href;
                if (!absolute.startsWith(location.origin)) continue;
                if (absolute.includes('/b/')) continue;
                urls.push(absolute);
              }
              return [...new Set(urls)];
            }
            """
        )

    return hrefs[:max_posts]


async def extract_request(page, board_name: str, url: str) -> RequestItem | None:
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=90000)
        await page.wait_for_timeout(2000)
    except PlaywrightTimeoutError:
        return None

    # Try extracting from DOM directly first.
    data = await page.evaluate(
        """
        () => {
          const pickText = (selectors) => {
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el && el.textContent && el.textContent.trim()) return el.textContent.trim();
            }
            return null;
          };

          const pickTexts = (selectors) => {
            for (const sel of selectors) {
              const els = Array.from(document.querySelectorAll(sel));
              const vals = els.map(e => (e.textContent || '').trim()).filter(Boolean);
              if (vals.length) return vals;
            }
            return [];
          };

          const title = pickText(['h1', '[data-testid="post-title"]', 'main h1', 'article h1']);
          const bodyCandidates = pickTexts([
            '[data-testid="post-description"]',
            'article',
            'main',
            '[role="main"]'
          ]);

          const status = pickText([
            '[data-testid="post-status"]',
            '[class*="status"]',
            'button[aria-current="true"]'
          ]);

          const metaTexts = pickTexts(['body']);
          return {
            title,
            body: bodyCandidates.join("\\n\\n"),
            status,
            allText: metaTexts.join("\\n")
          };
        }
        """
    )

    html = await page.content()
    soup = BeautifulSoup(html, "html.parser")

    title = clean_text(data.get("title") or (soup.find("h1").get_text(" ", strip=True) if soup.find("h1") else ""))
    if not title:
        return None

    # Body cleanup. Use DOM-derived text, then strip repeated title/noise.
    body = clean_text(data.get("body") or "")
    if title and body.startswith(title):
        body = clean_text(body[len(title):])

    if len(body) < 40:
        main = soup.find("main") or soup.body
        body = clean_text(main.get_text(" ", strip=True) if main else "")

    # Try pulling weak metadata from page text.
    page_text = clean_text(data.get("allText") or soup.get_text(" ", strip=True))
    votes = extract_int(re.search(r"(\d[\d,]*)\s+votes?", page_text, re.I).group(0)) if re.search(r"(\d[\d,]*)\s+votes?", page_text, re.I) else None
    comments = extract_int(re.search(r"(\d[\d,]*)\s+comments?", page_text, re.I).group(0)) if re.search(r"(\d[\d,]*)\s+comments?", page_text, re.I) else None

    status = clean_text(data.get("status") or "")
    if not status:
        m = re.search(r"\b(open|planned|under review|in progress|complete|closed)\b", page_text, re.I)
        status = m.group(1).lower() if m else None

    author = None
    created_at = None

    return RequestItem(
        board=board_name,
        url=url,
        slug=safe_slug(url),
        title=title,
        body=body,
        status=status,
        votes=votes,
        comments=comments,
        author=author,
        created_at=created_at,
    )


async def scrape_requests(board_urls: list[str], max_posts_per_board: int) -> list[RequestItem]:
    items: list[RequestItem] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=HEADLESS)
        context = await browser.new_context()
        page = await context.new_page()

        for board_url in board_urls:
            board_name = board_url.rstrip("/").split("/")[-1].replace("-", " ")
            print(f"Collecting links from {board_name} ...")
            links = await collect_post_links(page, board_url, max_posts_per_board)
            print(f"Found {len(links)} candidate links in {board_name}")

            for idx, url in enumerate(links, start=1):
                print(f"  [{idx}/{len(links)}] {url}")
                item = await extract_request(page, board_name, url)
                if item:
                    items.append(item)

        await browser.close()

    deduped: dict[str, RequestItem] = {}
    for item in items:
        deduped[item.url] = item
    return list(deduped.values())


def cluster_requests(items: list[RequestItem]) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    rows: list[dict[str, Any]] = []
    for item in items:
        combined = clean_text(f"{item.title}. {item.body}")
        rows.append(
            {
                **asdict(item),
                "combined_text": combined,
                "summary": compact_summary(item.title, item.body),
            }
        )

    df = pd.DataFrame(rows)
    if df.empty:
        return df, []

    model = SentenceTransformer("all-MiniLM-L6-v2")
    embeddings = model.encode(df["combined_text"].tolist(), normalize_embeddings=True)

    # Cosine distance on normalized vectors.
    clustering = DBSCAN(eps=0.22, min_samples=2, metric="cosine")
    labels = clustering.fit_predict(embeddings)
    df["cluster_id"] = labels

    # Give singleton/noise items their own synthetic cluster ids so everything is grouped.
    next_cluster_id = (df["cluster_id"].max() + 1) if (df["cluster_id"] >= 0).any() else 0
    synthetic_ids: list[int] = []
    for label in df["cluster_id"].tolist():
        if label == -1:
            synthetic_ids.append(next_cluster_id)
            next_cluster_id += 1
        else:
            synthetic_ids.append(int(label))
    df["cluster_id"] = synthetic_ids

    cluster_records: list[dict[str, Any]] = []
    for cluster_id, group in df.groupby("cluster_id", sort=False):
        texts = group["combined_text"].tolist()
        title_label = keyword_label(texts)

        cluster_records.append(
            {
                "cluster_id": int(cluster_id),
                "category": title_label,
                "request_count": int(len(group)),
                "boards": sorted(group["board"].dropna().unique().tolist()),
                "statuses": Counter([s for s in group["status"].dropna().tolist()]).most_common(),
                "total_votes": int(group["votes"].fillna(0).sum()),
                "total_comments": int(group["comments"].fillna(0).sum()),
                "representative_titles": group["title"].head(5).tolist(),
                "representative_urls": group["url"].head(5).tolist(),
                "items": group[
                    ["title", "summary", "url", "board", "status", "votes", "comments"]
                ].to_dict(orient="records"),
            }
        )

    cluster_records.sort(
        key=lambda x: (x["request_count"], x["total_votes"], x["total_comments"]),
        reverse=True,
    )

    rank_map = {rec["cluster_id"]: idx + 1 for idx, rec in enumerate(cluster_records)}
    df["category"] = df["cluster_id"].map({rec["cluster_id"]: rec["category"] for rec in cluster_records})
    df["cluster_rank"] = df["cluster_id"].map(rank_map)

    return df, cluster_records


def write_outputs(df: pd.DataFrame, clusters: list[dict[str, Any]]) -> None:
    raw_cols = [
        "board", "title", "body", "summary", "status",
        "votes", "comments", "url", "slug"
    ]
    clustered_cols = [
        "cluster_rank", "cluster_id", "category", "board", "title",
        "summary", "status", "votes", "comments", "url"
    ]

    df[raw_cols].to_csv("buffer_requests_raw.csv", index=False)
    df[clustered_cols].sort_values(["cluster_rank", "title"]).to_csv(
        "buffer_requests_clustered.csv", index=False
    )

    with open("buffer_feature_clusters.json", "w", encoding="utf-8") as f:
        json.dump(clusters, f, ensure_ascii=False, indent=2)

    print("Wrote:")
    print("  - buffer_requests_raw.csv")
    print("  - buffer_requests_clustered.csv")
    print("  - buffer_feature_clusters.json")


async def main() -> None:
    started = time.time()
    items = await scrape_requests(BOARD_URLS, MAX_POSTS_PER_BOARD)
    print(f"Scraped {len(items)} request pages")

    df, clusters = cluster_requests(items)
    write_outputs(df, clusters)

    print("\nTop categories:")
    for rec in clusters[:15]:
        print(
            f"- #{rec['cluster_id']} | {rec['category']} "
            f"| requests={rec['request_count']} votes={rec['total_votes']} comments={rec['total_comments']}"
        )
        for title in rec["representative_titles"][:3]:
            print(f"    • {title}")

    elapsed = time.time() - started
    print(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    asyncio.run(main())