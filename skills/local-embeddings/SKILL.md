---
name: local-embeddings
description: Generate text embeddings using local nomic-embed-text model (RTX 3090).
metadata: { "openclaw": { "emoji": "🧮", "requires": { "bins": ["curl"] } } }
---

# Local Embeddings (nomic-embed-text-v1.5)

Generate text embedding vectors using nomic-embed-text-v1.5 running locally on the RTX 3090.
Useful for semantic search, similarity comparison, and clustering.
No API keys required — fully local and private.

## Quick start

```bash
{baseDir}/scripts/embed.sh "What is the meaning of life?"
```

## Options

```bash
{baseDir}/scripts/embed.sh "search query" --task search_query
{baseDir}/scripts/embed.sh "document text" --task search_document
{baseDir}/scripts/embed.sh --file /path/to/texts.txt
{baseDir}/scripts/embed.sh "text1" "text2" "text3"
{baseDir}/scripts/embed.sh "hello world" --dims-only
```

## Task types

- `search_document` — for documents being indexed (default)
- `search_query` — for search queries
- `clustering` — for clustering tasks
- `classification` — for classification tasks

## Output

Returns 768-dimensional embedding vectors in JSON format (OpenAI-compatible).

## Service

Runs on `localhost:8105`. Start with `bash /home/mferr/multimodal/scripts/start-all.sh embeddings`.
