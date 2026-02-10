---
name: local-vision
description: Analyze and describe images using local Qwen2.5-VL vision model (RTX 3090).
metadata: { "openclaw": { "emoji": "👁️", "requires": { "bins": ["curl"] } } }
---

# Local Vision (Qwen2.5-VL)

Analyze images using Qwen2.5-VL-7B-Instruct-AWQ running locally on the RTX 3090.
No API keys required — fully local and private.

## Quick start

```bash
{baseDir}/scripts/describe.sh /path/to/image.jpg
```

## Options

```bash
{baseDir}/scripts/describe.sh /path/to/photo.png --prompt "What objects are in this image?"
{baseDir}/scripts/describe.sh /path/to/screenshot.jpg --prompt "Extract all text from this image"
{baseDir}/scripts/describe.sh /path/to/diagram.png --prompt "Explain this diagram" --max-tokens 1024
{baseDir}/scripts/describe.sh /path/to/image.jpg --json
```

## Supported formats

PNG, JPG, JPEG, WebP, BMP, GIF.

## Service

Runs on `localhost:8102`. Start with `bash /home/mferr/multimodal/scripts/start-all.sh vision`.
