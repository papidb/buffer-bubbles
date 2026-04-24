# buffer-bubbles

An interactive way to explore Buffer feature requests as clusters instead of isolated posts.

Live app: https://buffer-bubbles.danielubenjamin.com/

![Buffer Bubbles home screen](./buffer-bubbles-home.png)

## Motivation

Buffer's public suggestion boards are useful because the raw requests are already there in the open. The problem is that long chronological lists are not great at showing recurring themes.

If ten people ask for roughly the same thing in slightly different words, the board still reads like ten separate posts. That makes it hard to answer questions like:

- What themes come up again and again?
- Which requests are isolated one-offs, and which ones form a pattern?
- Where are comments piling up, even if votes are low?
- How do requests distribute across Buffer's different boards?

`buffer-bubbles` is an attempt to make those patterns visible.

Instead of reading one post at a time, this project:

1. scrapes Buffer's public suggestion boards,
2. turns each request into text suitable for semantic comparison,
3. clusters similar requests together,
4. ranks those clusters by demand signals,
5. renders the result as a zoomable bubble map you can inspect.

The goal is not to replace the source boards. The goal is to add a better reading layer on top of them.

## What the project does

The repository has two main parts:

- a **Python crawler + clustering pipeline** in `crawler/`
- a **React frontend** in `frontend/` that reads the generated JSON and visualizes it

At a high level, the workflow looks like this:

```text
                +-----------------------------------+
                | Buffer public suggestion boards   |
                |                                   |
                | - feature suggestions             |
                | - new channel requests            |
                | - buffer api                      |
                +-------------------+---------------+
                                    |
                                    v
                    +---------------+----------------+
                    | crawler/rank.py                |
                    |                                |
                    | 1. collect post links          |
                    | 2. visit each request page     |
                    | 3. extract title/body/metadata |
                    | 4. normalize text              |
                    +---------------+----------------+
                                    |
                                    v
                    +---------------+----------------+
                    | Embedding + clustering         |
                    |                                |
                    | - sentence-transformers        |
                    | - DBSCAN over cosine distance  |
                    | - keyword labels per cluster   |
                    +---------------+----------------+
                                    |
                                    v
                    +---------------+----------------+
                    | Output files                    |
                    |                                |
                    | - buffer_requests_raw.csv      |
                    | - buffer_requests_clustered.csv|
                    | - buffer_feature_clusters.json |
                    +---------------+----------------+
                                    |
                                    v
                    +---------------+----------------+
                    | run.sh                         |
                    | copies JSON into frontend      |
                    +---------------+----------------+
                                    |
                                    v
                    +---------------+----------------+
                    | React + Vite frontend          |
                    |                                |
                    | - filters and search           |
                    | - zoomable bubble canvas       |
                    | - cluster detail panel         |
                    +--------------------------------+
```

## Repository structure

```text
.
├── README.md
├── buffer-bubbles-home.png
├── Dockerfile
├── run.sh
├── crawler/
│   ├── pyproject.toml
│   ├── uv.lock
│   ├── rank.py
│   ├── main.py
│   ├── buffer_requests_raw.csv
│   ├── buffer_requests_clustered.csv
│   └── buffer_feature_clusters.json
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── src/
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── index.css
    │   ├── data/clusters.json
    │   ├── components/ui/input.tsx
    │   └── components/ui/multi-select.tsx
    └── ...
```

Key files:

- `crawler/rank.py` — the real crawler, clustering logic, and output generation
- `run.sh` — runs the crawler and copies the generated JSON into the frontend
- `frontend/src/App.tsx` — the full interactive application
- `frontend/src/data/clusters.json` — the dataset currently used by the UI
- `Dockerfile` — builds and serves the frontend as a static app

## Crawler architecture

The crawler is implemented in `crawler/rank.py`.

It uses:

- **Playwright** to load and inspect Buffer suggestion pages
- **BeautifulSoup** as a fallback parser for HTML extraction
- **pandas** to shape the extracted data into tables
- **sentence-transformers** to embed request text
- **scikit-learn / DBSCAN** to group semantically related requests

### Step 1: discover request URLs

The script starts from three board URLs:

```text
https://suggestions.buffer.com/b/feature-suggestions
https://suggestions.buffer.com/b/new-channel-requests
https://suggestions.buffer.com/b/buffer-api
```

For each board it:

1. opens the board page in Chromium,
2. auto-scrolls until content stops growing,
3. extracts candidate links from the DOM,
4. filters out obvious non-request URLs such as board pages and roadmap pages.

This is handled by:

- `auto_scroll(...)`
- `collect_post_links(...)`

### Step 2: visit each request page and extract content

For every collected URL, `extract_request(...)` visits the page and tries to pull:

- title
- body / description
- status
- votes
- comments
- URL / slug
- board name

Extraction is intentionally redundant:

- it first tries DOM-based selectors in the browser,
- then falls back to parsing full HTML with BeautifulSoup,
- then uses regexes against page text for weak metadata such as votes, comments, and status.

This makes the crawler more resilient to layout drift on the source site.

### Step 3: normalize each request into a clustering document

Each request becomes a `RequestItem` dataclass with fields like `title`, `body`, `status`, `votes`, and `comments`.

The script then builds a combined text field:

```text
combined_text = clean(title + ". " + body)
```

It also generates a shortened `summary` via `compact_summary(...)` for UI display.

### Step 4: optionally reuse cached crawl output

The script does not always re-scrape the web.

If `buffer_requests_raw.csv` already exists and `FORCE_CRAWL` is not set to `true`, the pipeline skips crawling and reconstructs items from the cached CSV with `load_cached_items(...)`.

That gives you a faster iteration loop when you are only changing clustering or visualization.

### Step 5: write analysis outputs

After clustering, the crawler writes three files:

- `buffer_requests_raw.csv`
- `buffer_requests_clustered.csv`
- `buffer_feature_clusters.json`

Those outputs serve different purposes:

- **raw CSV**: easy inspection of scraped records
- **clustered CSV**: easy inspection of ranking + per-item grouping
- **JSON**: the frontend-ready dataset

## How clustering works

The clustering stage is compact, but it is the heart of the project.

### Input to clustering

Every request is reduced to a single semantic text payload:

```text
title + body
```

The title helps preserve the core ask, while the body adds enough context for semantic similarity.

### Embeddings

`cluster_requests(...)` loads:

```text
SentenceTransformer("all-MiniLM-L6-v2")
```

Then it encodes every request's `combined_text` using normalized embeddings.

Normalized embeddings matter because the next stage uses cosine distance.

### Clustering algorithm

The project uses **DBSCAN** with:

```text
eps = 0.22
min_samples = 2
metric = "cosine"
```

Why DBSCAN is a good fit here:

- you do **not** need to guess the number of clusters up front,
- it can leave unrelated posts as noise,
- it naturally groups dense semantic neighborhoods.

In other words, it matches the shape of the problem better than something like k-means.

### What happens to noise points?

DBSCAN marks isolated items as `-1` noise.

This project does **not** throw those away.

Instead, every noise item gets its own synthetic cluster id, so the final output still contains every request.

That means the UI can show:

- large recurring themes,
- medium-sized related groups,
- singleton requests that did not cluster with anything else.

### Cluster labeling

The code does not use an LLM to name clusters.

Instead, `keyword_label(...)` extracts tokens from the grouped texts, removes a custom stopword list, counts token frequency, and joins the top few keywords with `/`.

That is why categories look like this:

```text
ago / post / comments / posts
instagram / posts / ago / post
channel / ago / channels / accounts
```

These labels are deliberately lightweight. They are not polished product copy; they are compact hints about what the cluster contains.

### Ranking

Clusters are sorted by:

1. `request_count`
2. `total_votes`
3. `total_comments`

descending.

That ranking becomes `cluster_rank` in the tabular output and gives the frontend a demand-oriented ordering.

## Clustering data flow

```text
  One Buffer request page
            |
            v
  +-----------------------------+
  | title                        |
  | body                         |
  | status / votes / comments    |
  +-----------------------------+
            |
            v
  clean_text(title + body)
            |
            v
  sentence embedding
            |
            v
  DBSCAN over cosine distance
            |
      +-----+-------------------------+
      |                               |
      v                               v
 clustered with neighbors         no neighbors / noise
      |                               |
      v                               v
 shared cluster id                synthetic singleton id
      |                               |
      +---------------+---------------+
                      |
                      v
         aggregate cluster statistics
         - request_count
         - total_votes
         - total_comments
         - boards
         - statuses
         - representative titles
         - representative URLs
                      |
                      v
         frontend-ready JSON clusters
```

## Frontend architecture

The frontend is a Vite + React + TypeScript app.

The entry point is:

- `frontend/src/main.tsx` → mounts `App.tsx`

The main application lives entirely in:

- `frontend/src/App.tsx`

### What the UI exposes

The app presents the clustered data as a dashboard with two main regions:

1. a **left bubble canvas** for exploration
2. a **right detail panel** for drill-down

At the top, the UI also includes:

- a search input
- multi-select board filters
- multi-select status filters
- three sizing modes
- overview metric cards

### Bubble chart behavior

The bubble view is rendered on an HTML **canvas**, not SVG.

That is important because the chart needs:

- a lot of nodes on screen at once,
- hover feedback,
- click hit-testing,
- zoom and pan,
- smooth redraws with minimal DOM overhead.

The current chart implementation in `App.tsx`:

- sizes bubbles by one of `requests`, `votes`, or `comments`,
- runs a D3 force simulation to position nodes,
- colors nodes by board,
- auto-fits the bubble bounds into view,
- supports canvas pan/zoom via `d3.zoom`,
- hides labels on tiny bubbles,
- shows a hover tooltip,
- keeps the selected cluster synced with the detail panel.

### Why the chart is canvas-based

The chart used to be a more traditional bubble layout, but the current implementation is designed around exploration density.

Canvas helps because it can handle:

- many circles without a DOM node per bubble,
- redraw-on-zoom interactions,
- dense layouts where SVG text and pointer handling would get heavy.

### UI data flow

```text
frontend/src/data/clusters.json
            |
            v
     React state in App.tsx
            |
            +------------------------+
            |                        |
            v                        v
   filter/search pipeline       selected cluster state
            |                        |
            v                        v
    filtered cluster list      right-hand detail panel
            |
            v
    D3 force layout + canvas draw
            |
            v
     zoomable bubble exploration
```

## How the deployed service works

The live app is available here:

https://buffer-bubbles.danielubenjamin.com/

At the time of inspection, the product worked like this:

### Page structure

The page opens as a single dashboard with:

- the eyebrow label **Feature request intelligence**,
- the heading **Interactive view of aggregated Buffer feature requests**,
- a short explainer about bubbles representing clustered demand,
- a control row,
- overview summary cards,
- the bubble chart,
- a selected-cluster panel on the right.

The right panel is populated immediately on load rather than starting empty.

### Search and filters

The control bar supports:

- text search across category labels, representative titles, and request summaries,
- multi-select filtering by board,
- multi-select filtering by status.

The status options surfaced in the deployed app included:

- `closed`
- `complete`
- `in progress`
- `open`
- `planned`

The board options surfaced included:

- `buffer api`
- `feature suggestions`

All of these controls update the visible totals live.

### Sizing modes

The three sizing modes are:

- **Size by requests**
- **Size by votes**
- **Size by comments**

These toggles change bubble radii only. They do not change which requests are in scope. Filtering changes the dataset; sizing changes how that dataset is visually emphasized.

### Bubble interactions

The chart supports:

- hover tooltips,
- click-to-select,
- pan,
- zoom.

Clicking a bubble updates the right-hand panel with:

- cluster title
- priority score
- request / vote / comment totals
- board chips
- status chips
- representative request cards

Clicking empty space does not clear the current selection; the last selected cluster remains active.

### Drill-down to source requests

The right panel is where the visual overview becomes actionable.

Each representative request card shows:

- the original title,
- a short summary,
- board label,
- vote count,
- comment count,
- status badge,
- an external-link affordance.

Those links open the original Buffer suggestion pages in a new tab.

## Running the project

### Prerequisites

- Python **3.13+** for the crawler
- Node **20+** for the frontend / Docker build path
- `uv` for the crawler workflow
- `pnpm` for the frontend

### 1. Run the crawler and sync JSON into the frontend

From the repo root:

```bash
./run.sh
```

What this does:

```text
repo root
   |
   +--> run.sh
           |
           +--> cd crawler
           +--> uv run python rank.py
           +--> produce buffer_feature_clusters.json
           +--> copy to frontend/src/data/clusters.json
```

If `crawler/buffer_requests_raw.csv` already exists, the crawler will skip re-scraping unless you force it.

### 2. Force a fresh crawl

```bash
cd crawler
FORCE_CRAWL=true uv run python rank.py
```

Other useful environment variables:

- `HEADLESS=true|false`
- `MAX_POSTS_PER_BOARD=200`
- `FORCE_CRAWL=true|false`

### 3. Run the frontend locally

```bash
cd frontend
pnpm install
pnpm dev
```

### 4. Build the frontend

```bash
cd frontend
pnpm build
```

## Docker

The root `Dockerfile` builds the frontend and serves the compiled static files with `serve`.

Build and run:

```bash
docker build -t buffer-bubbles .
docker run --rm -p 8080:8080 buffer-bubbles
```

This image packages the frontend only. It does not run the crawler inside the container.

## Notes and limitations

- Cluster labels are heuristic keyword summaries, not editorially cleaned names.
- The clustering quality depends heavily on the source text quality on the suggestion pages.
- Votes and comments are scraped from public page text and may be absent on some pages.
- The project is a reading layer over public suggestions, not an official Buffer product.
- Cached crawl reuse is convenient for iteration, but it also means your local JSON may lag behind the live boards unless you force a fresh crawl.

## Why this is useful

The main value of the project is that it changes the unit of reading.

Instead of asking a human to mentally cluster dozens or hundreds of posts, it gives them:

- a map of recurring themes,
- a quick sense of scale,
- a way to inspect grouped evidence,
- a path back to the original source threads.

That makes the public suggestion boards easier to scan, compare, and discuss.
