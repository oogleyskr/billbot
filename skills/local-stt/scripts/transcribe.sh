#!/usr/bin/env bash
# transcribe.sh — Transcribe audio using the local STT service (port 8101).
#
# Usage:
#   transcribe.sh <audio-file> [--language en] [--prompt "hint"] [--out file.txt] [--word-timestamps] [--json]

set -euo pipefail

SERVICE_URL="http://localhost:8101"

usage() {
    cat >&2 <<'EOF'
Usage:
  transcribe.sh <audio-file> [--language en] [--prompt "hint"] [--out /path/to/out.txt] [--word-timestamps] [--json]

Options:
  --language    Language code (e.g. en, es, fr). Auto-detected if omitted.
  --prompt      Context hint to guide transcription.
  --out         Output file path (default: prints to stdout).
  --word-timestamps  Include per-word timestamps.
  --json        Output full JSON response instead of just text.
EOF
    exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
fi

INPUT_FILE="$1"
shift

LANGUAGE=""
PROMPT=""
OUT_FILE=""
WORD_TIMESTAMPS="false"
JSON_OUTPUT=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --language) LANGUAGE="${2:-}"; shift 2 ;;
        --prompt) PROMPT="${2:-}"; shift 2 ;;
        --out) OUT_FILE="${2:-}"; shift 2 ;;
        --word-timestamps) WORD_TIMESTAMPS="true"; shift ;;
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
    echo "Error: STT service not running on $SERVICE_URL" >&2
    echo "Start it with: bash /home/mferr/multimodal/scripts/start-all.sh stt" >&2
    exit 1
fi

# Build curl command
CURL_ARGS=(
    -sS
    -X POST
    "$SERVICE_URL/transcribe"
    -F "file=@${INPUT_FILE}"
    -F "word_timestamps=${WORD_TIMESTAMPS}"
)

[[ -n "$LANGUAGE" ]] && CURL_ARGS+=(-F "language=${LANGUAGE}")
[[ -n "$PROMPT" ]] && CURL_ARGS+=(-F "prompt=${PROMPT}")

RESPONSE=$(curl "${CURL_ARGS[@]}")

if $JSON_OUTPUT; then
    if [[ -n "$OUT_FILE" ]]; then
        echo "$RESPONSE" > "$OUT_FILE"
        echo "$OUT_FILE"
    else
        echo "$RESPONSE"
    fi
else
    # Extract just the text field
    TEXT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['text'])" 2>/dev/null || echo "$RESPONSE")
    if [[ -n "$OUT_FILE" ]]; then
        echo "$TEXT" > "$OUT_FILE"
        echo "$OUT_FILE"
    else
        echo "$TEXT"
    fi
fi
