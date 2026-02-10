---
name: local-imagegen
description: Generate images from text prompts using local SDXL-Turbo (RTX 3090).
metadata: { "openclaw": { "emoji": "🎨", "requires": { "bins": ["curl"] } } }
---

# Local Image Generation (SDXL-Turbo)

Generate images from text prompts using SDXL-Turbo running locally on the RTX 3090.
Fast generation (1-4 steps). No API keys required — fully local and private.

## Quick start

```bash
{baseDir}/scripts/generate.sh "a cat sitting on a windowsill at sunset"
```

## Options

```bash
{baseDir}/scripts/generate.sh "a futuristic city" --out /tmp/city.png
{baseDir}/scripts/generate.sh "portrait of a robot" --steps 4 --size 512x512
{baseDir}/scripts/generate.sh "landscape painting" --negative "blurry, low quality"
{baseDir}/scripts/generate.sh "abstract art" --seed 42
```

## Notes

- SDXL-Turbo works best at 512x512 resolution
- 1-4 inference steps (default: 4). More steps = slightly better quality
- guidance_scale defaults to 0.0 (turbo mode). Increase for more prompt adherence

## Service

Runs on `localhost:8104`. Start with `bash /home/mferr/multimodal/scripts/start-all.sh imagegen`.
