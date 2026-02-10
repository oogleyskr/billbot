---
name: local-stt
description: Transcribe audio files to text using local faster-whisper (RTX 3090).
metadata: { "openclaw": { "emoji": "🎤", "requires": { "bins": ["curl"] } } }
---

# Local Speech-to-Text (faster-whisper)

Transcribe audio files using faster-whisper large-v3 running locally on the RTX 3090.
No API keys required — fully local and private.

## Quick start

```bash
{baseDir}/scripts/transcribe.sh /path/to/audio.wav
```

## Options

```bash
{baseDir}/scripts/transcribe.sh /path/to/audio.mp3 --language en
{baseDir}/scripts/transcribe.sh /path/to/audio.m4a --prompt "Speaker names: Alice, Bob"
{baseDir}/scripts/transcribe.sh /path/to/audio.ogg --out /tmp/transcript.txt
{baseDir}/scripts/transcribe.sh /path/to/audio.wav --word-timestamps
{baseDir}/scripts/transcribe.sh /path/to/audio.wav --json
```

## Supported formats

wav, mp3, m4a, ogg, flac, webm, and any format supported by ffmpeg.

## Service

Runs on `localhost:8101`. Start with `bash /home/mferr/multimodal/scripts/start-all.sh stt`.
