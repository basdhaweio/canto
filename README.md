# Canto

A personal study app for the Cantonese tutoring course (Dr. Candise Lin). Everything from the course PDFs — vocabulary, dialogues, grammar notes, exercises, the syllabus — transcribed into JSON and served as an installable web app.

**Live:** https://basdhaweio.github.io/canto/

## What it does

- **Flashcards** with spaced repetition (SM-2). Scope by unit, section, or card type (word→meaning, meaning→word, grammar examples, dialogue lines). Modes: daily review (due + new), due only, new only, cram.
- **Dialogues** with read / run-through (English hidden) / role-play (your lines hidden) modes. Tap any word for its meaning and a quick quiz that feeds the schedule.
- **Grammar** notes per unit with every example from the slides; hide a column to test yourself, or drill the examples as cards.
- **Exercises** unit by unit, with answers where they follow from the slides (confidence marked), self-marking, saved answers.
- **Dictionary** across every unit (characters, Jyutping with or without tones, English), starred words.
- **Sessions** — the syllabus, homework episode questions with saved answers, "next session" prep on the home screen.
- Works offline once loaded (service worker); progress lives in the browser, with export/import to move between devices.

## Layout

```
index.html, css/, js/     the app (vanilla JS, no build step)
data/index.json           list of units
data/units/unit-N.json    transcribed course content (see docs/CONTENT-SCHEMA.md)
data/syllabus.json        session plan + homework questions
tools/extract_pdf.py      PDF -> page images + text dump
tools/validate.py         checks every unit file
docs/INGEST.md            how to add a new unit from a PDF
docs/ROADMAP.md           what's planned next (notifications, AI, sync)
```

## Run locally

No Node needed:

```bash
python -m http.server 8080
```

then open http://localhost:8080/. (Opening `index.html` directly as a file won't work — `fetch` needs a server.)

## Adding a unit

See [docs/INGEST.md](docs/INGEST.md). Short version: extract the PDF with `tools/extract_pdf.py`, have Claude Code transcribe it against `docs/CONTENT-SCHEMA.md`, add it to `data/index.json`, run `tools/validate.py`, push.
