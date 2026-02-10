# Multimodal Capabilities

You now have 6 local AI services running on the RTX 3090 GPU. These give you vision, hearing, speech, image creation, document reading, and semantic search — all running locally with zero API costs and full privacy.

## Your New Skills

### /local-stt — Transcribe Audio

Convert speech to text. Supports wav, mp3, m4a, ogg, flac, webm.

```bash
# Basic transcription
{baseDir}/scripts/transcribe.sh /path/to/audio.wav

# With language hint and context
{baseDir}/scripts/transcribe.sh /path/to/meeting.mp3 --language en --prompt "Meeting between Alice and Bob"

# Get word-level timestamps
{baseDir}/scripts/transcribe.sh /path/to/audio.wav --word-timestamps --json

# Save to file
{baseDir}/scripts/transcribe.sh /path/to/audio.m4a --out /tmp/transcript.txt
```

---

### /local-vision — Describe & Analyze Images

Look at images and answer questions about them. Supports PNG, JPG, WebP, BMP, GIF.

```bash
# Describe what's in an image
{baseDir}/scripts/describe.sh /path/to/photo.jpg

# Ask a specific question
{baseDir}/scripts/describe.sh /path/to/screenshot.png --prompt "What text is visible in this image?"

# Analyze a diagram or chart
{baseDir}/scripts/describe.sh /path/to/chart.png --prompt "Summarize the data in this chart" --max-tokens 1024
```

---

### /local-tts — Speak Out Loud

Convert text to natural speech. Returns a WAV file.

```bash
# Say something (saves to /tmp/tts-output.wav)
{baseDir}/scripts/speak.sh "Hello! I'm BillBot and I can talk now."

# Choose a voice and save to a specific file
{baseDir}/scripts/speak.sh "Good morning" --voice am_adam --out /tmp/greeting.wav

# Read a file aloud
{baseDir}/scripts/speak.sh --file /path/to/notes.txt --voice bf_emma

# Speak faster or slower (0.5x to 2.0x)
{baseDir}/scripts/speak.sh "This is fast" --speed 1.5
```

**Voices:** `af_heart` (default), `af_bella`, `af_nicole`, `am_adam`, `am_michael`, `bf_emma`, `bm_george`, `bm_lewis`

---

### /local-imagegen — Generate Images

Create images from text descriptions using SDXL-Turbo. Fast (1-4 steps).

```bash
# Generate an image (saves to /tmp/imagegen-output.png)
{baseDir}/scripts/generate.sh "a golden retriever wearing sunglasses at the beach"

# Save to a specific file
{baseDir}/scripts/generate.sh "cyberpunk cityscape at night" --out /tmp/city.png

# Control quality and avoid things
{baseDir}/scripts/generate.sh "portrait of a scientist" --steps 4 --negative "blurry, low quality"

# Reproducible results with a seed
{baseDir}/scripts/generate.sh "abstract painting" --seed 42
```

Best results at 512x512 (default). The `--steps 4` default balances speed and quality.

---

### /local-embeddings — Semantic Search & Similarity

Turn text into 768-dimensional vectors for search, comparison, and clustering.

```bash
# Embed a single text
{baseDir}/scripts/embed.sh "What is machine learning?"

# Embed multiple texts
{baseDir}/scripts/embed.sh "cats are great" "dogs are loyal" "fish are quiet"

# Use the right task prefix for better results
{baseDir}/scripts/embed.sh "search query here" --task search_query
{baseDir}/scripts/embed.sh "document to index" --task search_document

# Quick summary (dimensions and norms, no raw vectors)
{baseDir}/scripts/embed.sh "hello world" --dims-only

# Embed lines from a file
{baseDir}/scripts/embed.sh --file /path/to/sentences.txt --task clustering
```

**Task types:** `search_document` (default, for indexing), `search_query` (for queries), `clustering`, `classification`

---

### /local-docparse — Read Documents

Extract text from PDFs, Word docs, spreadsheets, presentations, and more. CPU-only, no GPU needed.

```bash
# Parse a PDF
{baseDir}/scripts/parse.sh /path/to/report.pdf

# Get just the raw text
{baseDir}/scripts/parse.sh /path/to/document.docx --text-only

# Full JSON with metadata
{baseDir}/scripts/parse.sh /path/to/spreadsheet.xlsx --json

# Save extracted text
{baseDir}/scripts/parse.sh /path/to/slides.pptx --text-only --out /tmp/extracted.txt
```

**Supported:** `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.html`, `.txt`, `.md`, `.csv`, `.json`, `.xml`, `.yaml`

---

## How It Works

All 6 services run as FastAPI servers on the local RTX 3090:

| Service    | Port | Model                   | VRAM   |
| ---------- | ---- | ----------------------- | ------ |
| STT        | 8101 | faster-whisper large-v3 | ~3GB   |
| Vision     | 8102 | Qwen2.5-VL-7B-AWQ       | ~5GB   |
| TTS        | 8103 | Kokoro-82M              | ~0.5GB |
| ImageGen   | 8104 | SDXL-Turbo              | ~5GB   |
| Embeddings | 8105 | nomic-embed-text-v1.5   | ~0.5GB |
| DocParse   | 8106 | CPU-only (pymupdf)      | 0      |

The skill scripts are thin bash wrappers that `curl` the local endpoints. Everything stays on this machine — no data leaves the network.

## Service Management

If a service is down, the skill script will tell you and suggest how to start it:

```bash
# Start all services
bash /home/mferr/multimodal/scripts/start-all.sh

# Check what's running
bash /home/mferr/multimodal/scripts/status.sh

# Stop everything
bash /home/mferr/multimodal/scripts/stop-all.sh

# Start/stop individual services
bash /home/mferr/multimodal/scripts/start-all.sh stt tts
bash /home/mferr/multimodal/scripts/stop-all.sh vision
```

## Tips

- **First startup** downloads models from HuggingFace (~15-25 min). After that, starts are fast.
- **VRAM is tight** (~22.7GB / 24.6GB). If you hit OOM errors, stop a service you're not using.
- **STT handles any audio format** ffmpeg supports — don't worry about converting first.
- **Vision works best** with clear, well-lit images. For OCR, use the prompt "Extract all text from this image."
- **TTS output** is 24kHz WAV. For longer texts, it automatically chunks and concatenates.
- **ImageGen** is optimized for speed over quality. Great for quick concepts, not photo-realism.
- **Embeddings** are normalized (unit length). Use cosine similarity to compare them.
- **DocParse** is the lightest service (CPU-only). Good for quickly reading files you can't `cat`.

---

## FAQ

### How do I access these skills?

They're registered as **OpenClaw skills** — the same kind as `/weather`, `/github`, `/openai-whisper-api`, etc. They show up as slash commands you can invoke:

- `/local-stt` — calls `transcribe.sh` via exec
- `/local-vision` — calls `describe.sh` via exec
- `/local-tts` — calls `speak.sh` via exec
- `/local-imagegen` — calls `generate.sh` via exec
- `/local-embeddings` — calls `embed.sh` via exec
- `/local-docparse` — calls `parse.sh` via exec

You use them exactly like any other skill — invoke the script from the SKILL.md with the right arguments. The scripts handle all the curl-to-localhost plumbing for you. You can also call the endpoints directly with `curl` if you want more control.

### Do I use URLs or local filesystem paths?

**Local filesystem paths only.** All services run on localhost, so you pass paths like `/home/mferr/photos/cat.jpg` or `/tmp/recording.wav`. No URLs needed. For vision and STT, the script reads the file and uploads it to the local FastAPI server. For imagegen and TTS, the output is written to a local path (default `/tmp/`).

### How do I test everything?

Run the built-in test script:

```bash
bash /home/mferr/multimodal/scripts/test-all.sh
```

This exercises every endpoint with sample data and reports pass/fail. You can also check service health anytime with:

```bash
bash /home/mferr/multimodal/scripts/status.sh
```

### What about the spare VRAM?

Current usage is ~22.7GB / 24.6GB — tighter than planned because models are a bit larger in practice. There's ~1.6GB headroom, which is enough for inference but not for adding another model. If Oogley wants to free up space for experimentation, the heaviest services to stop are **Vision** (~5GB) and **ImageGen** (~5GB) — stopping either one gives plenty of room to play with.
