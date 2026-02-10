#!/usr/bin/env bash
# embed.sh — Generate text embeddings using the local embeddings service (port 8105).
#
# Usage:
#   embed.sh "text to embed" [--task search_document] [--file texts.txt] [--dims-only]

set -euo pipefail

SERVICE_URL="http://localhost:8105"

usage() {
    cat >&2 <<'EOF'
Usage:
  embed.sh "text" [--task search_document] [--dims-only]
  embed.sh "text1" "text2" "text3" [--task search_query]
  embed.sh --file /path/to/texts.txt [--task clustering]

Options:
  --task       Task type: search_document, search_query, clustering, classification
               (default: search_document)
  --file       Read texts from file (one per line)
  --dims-only  Only output the embedding dimensions, not the full vectors
EOF
    exit 2
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
fi

TEXTS=()
TASK="search_document"
FROM_FILE=""
DIMS_ONLY=false

# Collect positional args as texts, then parse flags
while [[ $# -gt 0 ]]; do
    case "$1" in
        --task) TASK="${2:-}"; shift 2 ;;
        --file) FROM_FILE="${2:-}"; shift 2 ;;
        --dims-only) DIMS_ONLY=true; shift ;;
        --*) echo "Unknown argument: $1" >&2; usage ;;
        *) TEXTS+=("$1"); shift ;;
    esac
done

# Read texts from file if specified
if [[ -n "$FROM_FILE" ]]; then
    if [[ ! -f "$FROM_FILE" ]]; then
        echo "Error: File not found: $FROM_FILE" >&2
        exit 1
    fi
    while IFS= read -r line; do
        [[ -n "$line" ]] && TEXTS+=("$line")
    done < "$FROM_FILE"
fi

if [[ ${#TEXTS[@]} -eq 0 ]]; then
    echo "Error: No text provided." >&2
    usage
fi

# Check if service is running
if ! curl -s -m 2 "$SERVICE_URL/health" >/dev/null 2>&1; then
    echo "Error: Embeddings service not running on $SERVICE_URL" >&2
    echo "Start it with: bash /home/mferr/multimodal/scripts/start-all.sh embeddings" >&2
    exit 1
fi

# Build JSON payload — single text or array
if [[ ${#TEXTS[@]} -eq 1 ]]; then
    JSON_PAYLOAD=$(python3 -c "
import json
print(json.dumps({'input': '${TEXTS[0]}', 'task_type': '${TASK}'}))
")
else
    # Multiple texts — build array
    JSON_PAYLOAD=$(python3 -c "
import json, sys
texts = $(python3 -c "import json; print(json.dumps([$(printf '"%s",' "${TEXTS[@]}')])"))"
    JSON_PAYLOAD=$(python3 -c "
import json
texts = []
$(for t in "${TEXTS[@]}"; do echo "texts.append($(python3 -c "import json; print(json.dumps('$t'))"))"; done)
print(json.dumps({'input': texts, 'task_type': '${TASK}'}))
")
fi

RESPONSE=$(curl -sS -X POST "$SERVICE_URL/embed" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD")

if $DIMS_ONLY; then
    echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"Embeddings: {len(data['data'])}, Dimensions: {data.get('dimensions', 'unknown')}\")
for item in data['data']:
    vec = item['embedding']
    print(f\"  [{item['index']}] norm={sum(x*x for x in vec)**0.5:.4f}, first5={vec[:5]}\")
"
else
    echo "$RESPONSE"
fi
