#!/usr/bin/env bash
# describe.sh — Describe/analyze an image using the local vision service (port 8102).
#
# Usage:
#   describe.sh <image-file> [--prompt "question"] [--max-tokens 512] [--json]

set -euo pipefail

SERVICE_URL="http://localhost:8102"

usage() {
    cat >&2 <<'EOF'
Usage:
  describe.sh <image-file> [--prompt "question about the image"] [--max-tokens 512] [--json]

Options:
  --prompt       Question or instruction (default: "Describe this image in detail.")
  --max-tokens   Maximum response length in tokens (default: 512)
  --json         Output full JSON response instead of just text
EOF
    exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
fi

INPUT_FILE="$1"
shift

PROMPT="Describe this image in detail."
MAX_TOKENS=512
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --prompt) PROMPT="${2:-}"; shift 2 ;;
        --max-tokens) MAX_TOKENS="${2:-512}"; shift 2 ;;
        --json) JSON_OUTPUT=true; shift ;;
        *) echo "Unknown argument: $1" >&2; usage ;;
    esac
done

if [[ ! -f "$INPUT_FILE" ]]; then
    echo "Error: File not found: $INPUT_FILE" >&2
    exit 1
fi

# Check if service is running
if ! curl -s -m 2 "$SERVICE_URL/health" >/dev/null 2>&1; then
    echo "Error: Vision service not running on $SERVICE_URL" >&2
    echo "Start it with: bash /home/mferr/multimodal/scripts/start-all.sh vision" >&2
    exit 1
fi

RESPONSE=$(curl -sS -X POST "$SERVICE_URL/describe" \
    -F "file=@${INPUT_FILE}" \
    -F "prompt=${PROMPT}" \
    -F "max_tokens=${MAX_TOKENS}")

if $JSON_OUTPUT; then
    echo "$RESPONSE"
else
    echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['text'])" 2>/dev/null || echo "$RESPONSE"
fi
