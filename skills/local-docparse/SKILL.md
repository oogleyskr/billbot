---
name: local-docparse
description: Parse and extract text from PDF, DOCX, XLSX, PPTX, and other documents locally.
metadata: { "openclaw": { "emoji": "📄", "requires": { "bins": ["curl"] } } }
---

# Local Document Parser

Parse and extract text from various document formats using a local CPU-only service.
No API keys or GPU required — fully local and private.

## Quick start

```bash
{baseDir}/scripts/parse.sh /path/to/document.pdf
```

## Options

```bash
{baseDir}/scripts/parse.sh /path/to/report.pdf --text-only
{baseDir}/scripts/parse.sh /path/to/spreadsheet.xlsx --json
{baseDir}/scripts/parse.sh /path/to/presentation.pptx --out /tmp/extracted.txt
```

## Supported formats

- **PDF** (.pdf) — Full text extraction with page-level output
- **Word** (.docx) — Paragraphs and tables
- **Excel** (.xlsx) — All sheets with cell data
- **PowerPoint** (.pptx) — Slide-by-slide text
- **HTML** (.html, .htm) — Cleaned text extraction
- **Text** (.txt, .md, .csv, .json, .xml, .yaml, .yml, .log)

## Service

Runs on `localhost:8106`. Start with `bash /home/mferr/multimodal/scripts/start-all.sh docutils`.
