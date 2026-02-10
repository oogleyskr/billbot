#!/usr/bin/env bash
# parse.sh — Parse a document and extract text using the local docutils service (port 8106).
#
# Usage:
#   parse.sh <document-file> [--text-only] [--json] [--out file.txt]

set -euo pipefail

SERVICE_URL="http://localhost:8106"

usage() {
    cat >&2 <<'EOF'
Usage:
  parse.sh <document-file> [--text-only] [--json] [--out /path/to/output.txt]

Options:
  --text-only  Output only the extracted text (no metadata)
  --json       Output full JSON response with metadata
  --out        Write output to file instead of stdout

Supported: .pdf, .docx, .xlsx, .pptx, .html, .txt, .md, .csv, .json, .xml, .yaml
EOF
    exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
fi

INPUT_FILE="$1"
shift

TEXT_ONLY=false
JSON_OUTPUT=false
OUT_FILE=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --text-only) TEXT_ONLY=true; shift ;;
        --json) JSON_OUTPUT=true; shift ;;
        --out) OUT_FILE="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage ;;
    esac
done

if [[ ! -f "$INPUT_FILE" ]]; then
    echo "Error: File not found: $INPUT_FILE" >&2
    exit 1
fi

# Check if service is running
if ! curl -s -m 2 "$SERVICE_URL/health" >/dev/null 2>&1; then
    echo "Error: DocUtils service not running on $SERVICE_URL" >&2
    echo "Start it with: bash /home/mferr/multimodal/scripts/start-all.sh docutils" >&2
    exit 1
fi

RESPONSE=$(curl -sS -X POST "$SERVICE_URL/parse" -F "file=@${INPUT_FILE}")

# Format output based on flags
if $TEXT_ONLY; then
    OUTPUT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('full_text',''))" 2>/dev/null || echo "$RESPONSE")
elif $JSON_OUTPUT; then
    OUTPUT="$RESPONSE"
else
    # Default: show text with basic metadata header
    OUTPUT=$(echo "$RESPONSE" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f\"--- {data.get('filename', 'document')} ({data.get('format', '?')}) ---\")
if 'pages' in data:
    print(f\"Pages: {data['pages']}\")
if 'sheets' in data:
    print(f\"Sheets: {', '.join(data['sheets'])}\")
if 'slides' in data:
    print(f\"Slides: {data['slides']}\")
print(f\"Size: {data.get('file_size', 0)} bytes\")
print(f\"Parsed in: {data.get('processing_time', 0)}s\")
print()
print(data.get('full_text', ''))
" 2>/dev/null || echo "$RESPONSE")
fi

if [[ -n "$OUT_FILE" ]]; then
    mkdir -p "$(dirname "$OUT_FILE")"
    echo "$OUTPUT" > "$OUT_FILE"
    echo "$OUT_FILE"
else
    echo "$OUTPUT"
fi
