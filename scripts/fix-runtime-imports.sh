#!/bin/bash
# Fix tsdown build output: redirect __exportAll imports from gateway-cli chunks
# to the standalone rolldown-runtime chunk to avoid circular dependency issues.

DIST_DIR="${1:-dist}"

RUNTIME_FILE=$(ls "$DIST_DIR"/rolldown-runtime-*.js 2>/dev/null | head -1)
if [ -z "$RUNTIME_FILE" ]; then
  echo "No rolldown-runtime chunk found in $DIST_DIR - skipping"
  exit 0
fi

RUNTIME_BASENAME=$(basename "$RUNTIME_FILE")
FIXED=0

for f in "$DIST_DIR"/*.js; do
  [ "$f" = "$RUNTIME_FILE" ] && continue

  # Check if this file imports __exportAll from a gateway-cli chunk
  if grep -q 'as __exportAll.*from "./gateway-cli-' "$f" 2>/dev/null; then
    # Replace the import source with rolldown-runtime
    sed -i "s|import { t as __exportAll } from \"./gateway-cli-[^\"]*\"|import { t as __exportAll } from \"./$RUNTIME_BASENAME\"|g" "$f"
    FIXED=$((FIXED + 1))
  fi
done

if [ "$FIXED" -gt 0 ]; then
  echo "Fixed __exportAll imports in $FIXED files -> $RUNTIME_BASENAME"
else
  echo "No __exportAll import fixes needed"
fi
