# Content schema

Every unit lives in `data/units/unit-N.json` and is listed in `data/index.json`.
The app never edits these files; they are the source of truth transcribed from the course PDFs.

## Conventions

- **Romanisation is Jyutping with tone digits**, exactly as printed in the slides (`zou2 san4`). Syllables separated by single spaces. Keep the slides' spelling even when it differs from standard Jyutping (e.g. the course writes `nguk1`, `cing2`, `lai4`).
- **Characters**: use the characters printed on the slides (they are simplified). Never substitute "more correct" characters. If the slide prints no characters for an item, use `""`.
- **English**: as printed, lightly tidied (capitalised first letter, no trailing period). Keep parenthetical notes.
- **IDs**: stable, lowercase, unit-prefixed: vocab `u1-v012`, dialogues `u1-d1`, dialogue lines `u1-d1-l03`, grammar `u1-g03`, examples `u1-g03-e02`, exercises `u1-e2`, exercise items `u1-e2-i03`. Numbers are zero-padded to the width shown. IDs are referenced by saved progress, so never renumber existing items; append new ones.
- Use `""` (not `null`) for missing strings, `[]` for missing lists.
- Unicode ellipsis `…` for slot markers as printed (`太…啦…`).

## Unit file

```jsonc
{
  "id": "unit-1",
  "number": 1,                       // 0 for Phonology
  "title": "Encounters",
  "sources": ["Unit 1 Encounters.pdf", "Unit 1-2 Practice.pdf"],
  "goals": ["How to greet and address people"],
  "vocab": [
    {
      "id": "u1-v001",
      "zh": "早晨",
      "jp": "zou2 san4",
      "en": "Good morning",
      "section": "Dialogue 1",        // slide grouping: "Dialogue 1", "Dialogue 2", "Numbers", "Phonology", "Grammar"
      "pos": "",                      // optional: noun, verb, adj, particle, classifier, pronoun, number, phrase, surname
      "notes": ""                     // e.g. "note the tone change", "used before a classifier"
    }
  ],
  "dialogues": [
    {
      "id": "u1-d1",
      "title": "Dialogue 1",
      "setting": "Mr. Wong and his boss Miss Cheung meet in the lift on the way up to the office",
      "lines": [
        { "id": "u1-d1-l01", "speaker": "Cheung", "zh": "早晨，王先生。", "jp": "zou2 san4, Wong4 sin1 saang1", "en": "Good morning, Mr. Wong" }
      ],
      "questions": ["Whether Zoeng1 siu2 ze2 has a husband or not?"]   // comprehension questions printed after the dialogue
    }
  ],
  "grammar": [
    {
      "id": "u1-g01",
      "title": "Identifying people and things",
      "summary": "Personal pronouns are made plural with the suffix dei6.",   // 1-3 sentence gist
      "body": "Full explanation as bullet points joined with \n. Keep the slide's wording.",
      "examples": [
        { "id": "u1-g01-e01", "jp": "ngo5 dei6", "zh": "我哋", "en": "We, us", "lit": "" }   // lit = literal gloss when the slide gives one
      ],
      "tags": ["pronouns", "plural"]
    }
  ],
  "exercises": [
    {
      "id": "u1-e1",
      "title": "Exercise 1",
      "source": "Unit 1 Encounters.pdf",          // which PDF (unit slides or a Practice PDF)
      "instructions": "The following words have got all jumbled up. Sort them out and make meaningful sentences of them.",
      "type": "reorder",                           // reorder | reply | fill | translate | truefalse | listen | open
      "items": [
        { "id": "u1-e1-i01", "prompt": "Hou2 keoi5 dei6 hou2", "answer": "Keoi5 dei6 hou2 hou2", "answer_en": "They are very well", "hint": "", "confidence": "high" }
      ]
    }
  ],
  "notes": [                                     // culture / reference boxes that are neither grammar nor vocab
    { "id": "u1-n1", "title": "Cantonese surnames", "body": "The most common: Wong wong4 王/黄 …" }
  ]
}
```

### Exercise answers

`answer` is only filled in when the slides print it or it follows unambiguously from the unit's taught material; set `confidence` to `high`, `medium` or `low`. Leave `answer` as `""` with `confidence: "none"` for open-ended tasks (free translation of unseen vocab, "what would you reply"). The app shows unanswered items as "check with tutor".

### Phonology (unit-0)

Consonants, vowels and tones are stored as `grammar` entries tagged `phonology`, with the example words as `examples`. Minimal pairs / practice words go in `vocab` with `section: "Phonology"` so they can be drilled as flashcards.

## `data/index.json`

```json
{ "units": [ { "id": "unit-0", "number": 0, "title": "Phonology", "file": "units/unit-0.json" } ],
  "syllabus": "syllabus.json" }
```

## `data/syllabus.json`

Tutor schedule and per-session homework (TV episode questions), transcribed from Syllabus.pdf.
