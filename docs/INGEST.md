# Adding a new unit (PDF → app)

The app reads `data/units/*.json`; nothing else changes when a unit is added.

## 1. Extract the PDF

```bash
python tools/extract_pdf.py "C:/Users/Com/OneDrive/Documents/Canto/Unit 9 Health.pdf" "C:/Users/Com/OneDrive/Documents/Canto/Unit 9 Practice.pdf"
```

This writes page images and a text dump to `work/<slug>/` (git-ignored).

## 2. Transcribe into JSON

Open a Claude Code session in this repo and ask it to transcribe the unit, e.g.:

> Transcribe work/Unit_9_Health (plus work/Unit_9_Practice) into data/units/unit-9.json following docs/CONTENT-SCHEMA.md. Read every page image; use text.txt to confirm characters and tone digits.

Claude reads every page image (tables are unreliable in the text layer), uses the text layer for exact characters, and writes the file. Practice PDFs go into the same unit's `exercises` with their own `source`.

## 3. Register and validate

Add the unit to the `units` list in `data/index.json`, then:

```bash
python tools/validate.py
```

Fix anything it prints (duplicate ids, odd Jyutping, missing fields).

## 4. Publish

```bash
git add data && git commit -m "content: unit 9" && git push
```

GitHub Pages redeploys in about a minute. The app fetches data network-first, so a reload picks it up; the installed app gets it on next launch.

## Editing existing content

Edit the JSON directly and keep ids stable. Saved progress (SRS state, exercise answers, notes) is keyed by id, so append new items rather than renumbering.

## Later: automatic ingestion

When the Claude API is wired in (see `docs/ROADMAP.md`), the plan is a `tools/ingest.py` that sends page images to Claude with the schema and writes the JSON without a manual session.
