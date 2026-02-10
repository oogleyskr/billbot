---
name: local-tts
description: Convert text to speech using local Kokoro TTS model (RTX 3090).
metadata: { "openclaw": { "emoji": "🔊", "requires": { "bins": ["curl"] } } }
---

# Local Text-to-Speech (Kokoro)

Convert text to natural-sounding speech using Kokoro-82M running locally on the RTX 3090.
No API keys required — fully local and private.

## Quick start

```bash
{baseDir}/scripts/speak.sh "Hello, this is a test of local text to speech."
```

## Options

```bash
{baseDir}/scripts/speak.sh "Hello world" --out /tmp/hello.wav
{baseDir}/scripts/speak.sh "Fast speech" --speed 1.5
{baseDir}/scripts/speak.sh "British accent" --voice bm_george
{baseDir}/scripts/speak.sh "Read this file" --file /path/to/text.txt
```

## Available voices

- `af_heart` — American Female (Heart) _default_
- `af_bella` — American Female (Bella)
- `af_nicole` — American Female (Nicole)
- `am_adam` — American Male (Adam)
- `am_michael` — American Male (Michael)
- `bf_emma` — British Female (Emma)
- `bm_george` — British Male (George)
- `bm_lewis` — British Male (Lewis)

## Service

Runs on `localhost:8103`. Start with `bash /home/mferr/multimodal/scripts/start-all.sh tts`.
