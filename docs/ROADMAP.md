# Roadmap

Core (flashcards, dialogues, grammar, exercises, dictionary, sessions, offline PWA) shipped first. These are the agreed later phases.

## 1. Phone notifications

Preferred: **ntfy** (free; install the app, subscribe to a private topic).

- A GitHub Actions workflow on a cron sends a morning "review time" ping and a Sunday "session tomorrow: Unit N" ping (syllabus-driven).
- Because progress lives in the browser, the server can't know the due count. Two options: (a) keep the ping generic; (b) once sync (phase 3) exists, the workflow reads the synced progress file and includes "N cards due".
- In-app: when the app is open it can also use the Notifications API for a same-day reminder.

Alternatives considered: Pushover ($5), email via Actions.

## 2. AI features (Claude API)

Key stored in the app's Settings (browser only); calls go straight from the browser with the `anthropic-dangerous-direct-browser-access` header.

- **Generate new examples** for any grammar point, constrained to vocabulary the learner has seen (pass the unit's vocab list in the prompt) so nothing is out of reach.
- **Explain this word in context** from the dialogue lookup sheet.
- **Free-answer checking** for exercises with no key: ask Claude to grade against the taught patterns and show the reasoning.
- **Automatic ingestion**: `tools/ingest.py` sends page images + `docs/CONTENT-SCHEMA.md` to Claude and writes `data/units/unit-N.json`, then `validate.py` runs. Replaces the manual Claude Code transcription session.

## 3. Cross-device sync

- Simplest: a private GitHub Gist holding the exported progress JSON; the app pushes after each session and pulls on launch (token in Settings). Merge rule already exists in `progress.importJSON`.
- Fallback stays: manual export/import.

## Smaller ideas

- Audio: TTS for Jyutping lines (browser SpeechSynthesis has a `zh-HK` voice on most phones) — try before building anything.
- Tone-only drills from Unit 0 minimal pairs.
- Typing mode for flashcards (type the Jyutping, tone digits optional, auto-grade).
- Heatmap of review days on the home screen.
- "Leech" handling: cards failed 5+ times get flagged for a note.
