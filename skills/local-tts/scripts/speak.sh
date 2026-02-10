#!/usr/bin/env bash
# speak.sh — Synthesize speech from text using the local TTS service (port 8103).
#
# Usage:
#   speak.sh "text to speak" [--out file.wav] [--voice af_heart] [--speed 1.0] [--file input.txt]

set -euo pipefail

SERVICE_URL="http://localhost:8103"

usage() {
    cat >&2 <<'EOF'
Usage:
  speak.sh "text to speak" [--out /path/to/output.wav] [--voice af_heart] [--speed 1.0]
  speak.sh --file /path/to/text.txt [--out output.wav] [--voice am_adam]

Options:
  --out     Output WAV file path (default: /tmp/tts-output.wav)
  --voice   Voice ID (default: af_heart). See service GET /voices for all options.
  --speed   Speed multiplier 0.5-2.0 (default: 1.0)
  --file    Read text from a file instead of command line argument
EOF
    exit 2
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
fi

TEXT=""
OUT_FILE="/tmp/tts-output.wav"
VOICE="af_heart"
SPEED="1.0"
FROM_FILE=""

# Parse first positional arg as text (if not a flag)
if [[ $# -gt 0 && "${1:0:2}" != "--" ]]; then
    TEXT="$1"
    shift
fi

while [[ $# -gt 0 ]]; do
    case "$1" in
        --out) OUT_FILE="${2:-}"; shift 2 ;;
        --voice) VOICE="${2:-}"; shift 2 ;;
        --speed) SPEED="${2:-}"; shift 2 ;;
        --file) FROM_FILE="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage ;;
    esac
done

# Read text from file if specified
if [[ -n "$FROM_FILE" ]]; then
    if [[ ! -f "$FROM_FILE" ]]; then
        echo "Error: File not found: $FROM_FILE" >&2
        exit 1
    fi
    TEXT=$(cat "$FROM_FILE")
fi

if [[ -z "$TEXT" ]]; then
    echo "Error: No text provided. Pass text as argument or use --file." >&2
    usage
fi

# Check if service is running
if ! curl -s -m 2 "$SERVICE_URL/health" >/dev/null 2>&1; then
    echo "Error: TTS service not running on $SERVICE_URL" >&2
    echo "Start it with: bash /home/mferr/multimodal/scripts/start-all.sh tts" >&2
    exit 1
fi

# Build JSON payload
JSON_PAYLOAD=$(python3 -c "
import json
print(json.dumps({
    'text': '''${TEXT}''',
    'voice': '${VOICE}',
    'speed': float('${SPEED}')
}))
")

mkdir -p "$(dirname "$OUT_FILE")"

curl -sS -X POST "$SERVICE_URL/speak" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD" \
    -o "$OUT_FILE"

# Check if output is valid (WAV files start with "RIFF")
if [[ -f "$OUT_FILE" ]] && head -c 4 "$OUT_FILE" | grep -q "RIFF"; then
    SIZE=$(stat -c%s "$OUT_FILE" 2>/dev/null || stat -f%z "$OUT_FILE" 2>/dev/null)
    echo "$OUT_FILE ($SIZE bytes)"
else
    echo "Error: TTS failed. Response:" >&2
    cat "$OUT_FILE" >&2
    rm -f "$OUT_FILE"
    exit 1
fi
