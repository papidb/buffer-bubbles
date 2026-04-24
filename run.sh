#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CRAWLER_DIR="$SCRIPT_DIR/crawler"
FRONTEND_DATA_DIR="$SCRIPT_DIR/frontend/src/data"
JSON_FILENAME="clusters.json"

echo "Running crawler..."
(cd "$CRAWLER_DIR" && uv run python rank.py)

SOURCE="$CRAWLER_DIR/buffer_feature_clusters.json"
if [ ! -f "$SOURCE" ]; then
  echo "Error: crawler did not produce $SOURCE" >&2
  exit 1
fi

mkdir -p "$FRONTEND_DATA_DIR"
cp "$SOURCE" "$FRONTEND_DATA_DIR/$JSON_FILENAME"
echo "Copied clusters JSON to frontend/src/data/$JSON_FILENAME"
