#!/usr/bin/env bash
# generate.sh — Generate an image from a text prompt using local SDXL-Turbo (port 8104).
#
# Usage:
#   generate.sh "prompt" [--out file.png] [--steps 4] [--size 512x512] [--negative "..."] [--seed 42]

set -euo pipefail

SERVICE_URL="http://localhost:8104"

usage() {
    cat >&2 <<'EOF'
Usage:
  generate.sh "prompt text" [--out /path/to/output.png] [--steps 4] [--size 512x512]
                            [--negative "things to avoid"] [--seed 42] [--guidance 0.0]

Options:
  --out        Output PNG file path (default: /tmp/imagegen-output.png)
  --steps      Inference steps 1-8 (default: 4)
  --size       Image size WxH (default: 512x512)
  --negative   Negative prompt (things to avoid)
  --seed       Random seed for reproducibility (-1 for random)
  --guidance   CFG guidance scale (default: 0.0 for turbo)
EOF
    exit 2
}

if [[ "${1:-}" == "" || "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
fi

PROMPT="$1"
shift

OUT_FILE="/tmp/imagegen-output.png"
STEPS=4
WIDTH=512
HEIGHT=512
NEGATIVE=""
SEED=-1
GUIDANCE=0.0

while [[ $# -gt 0 ]]; do
    case "$1" in
        --out) OUT_FILE="${2:-}"; shift 2 ;;
        --steps) STEPS="${2:-4}"; shift 2 ;;
        --size)
            SIZE="${2:-512x512}"
            WIDTH="${SIZE%x*}"
            HEIGHT="${SIZE#*x}"
            shift 2 ;;
        --negative) NEGATIVE="${2:-}"; shift 2 ;;
        --seed) SEED="${2:-}"; shift 2 ;;
        --guidance) GUIDANCE="${2:-}"; shift 2 ;;
        *) echo "Unknown argument: $1" >&2; usage ;;
    esac
done

# Check if service is running
if ! curl -s -m 2 "$SERVICE_URL/health" >/dev/null 2>&1; then
    echo "Error: ImageGen service not running on $SERVICE_URL" >&2
    echo "Start it with: bash /home/mferr/multimodal/scripts/start-all.sh imagegen" >&2
    exit 1
fi

mkdir -p "$(dirname "$OUT_FILE")"

# Build JSON payload using python for proper escaping
JSON_PAYLOAD=$(python3 -c "
import json
print(json.dumps({
    'prompt': $(python3 -c "import json; print(json.dumps('$PROMPT'))"),
    'negative_prompt': $(python3 -c "import json; print(json.dumps('$NEGATIVE'))"),
    'steps': int($STEPS),
    'guidance_scale': float($GUIDANCE),
    'width': int($WIDTH),
    'height': int($HEIGHT),
    'seed': int($SEED),
}))
")

curl -sS -X POST "$SERVICE_URL/generate" \
    -H "Content-Type: application/json" \
    -d "$JSON_PAYLOAD" \
    -o "$OUT_FILE"

# Check if output is valid PNG (starts with PNG magic bytes)
if [[ -f "$OUT_FILE" ]] && file "$OUT_FILE" | grep -q "PNG"; then
    SIZE=$(stat -c%s "$OUT_FILE" 2>/dev/null || stat -f%z "$OUT_FILE" 2>/dev/null)
    echo "$OUT_FILE ($SIZE bytes, ${WIDTH}x${HEIGHT})"
else
    echo "Error: Image generation failed. Response:" >&2
    cat "$OUT_FILE" >&2
    rm -f "$OUT_FILE"
    exit 1
fi
