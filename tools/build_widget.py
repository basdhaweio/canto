#!/usr/bin/env python
"""Build the home-screen widget decks (docs/WIDGET.md) from data/units/*.json.

Usage:
    python tools/build_widget.py           write widget/*.json
    python tools/build_widget.py --check   exit 1 if widget/*.json is out of date (validate.py runs this)

The card rules mirror the app (js/data.js deckOf): Unit 0 and grammar/practice words are
dictionary-only; words from each unit's Vocabulary slides (Set 1 / Set 2) are word cards;
entries with `fn` are particles & endings; section "Numbers" is the numbers deck.

Every deck file has the same flat shape so one KWGT layout works for all of them:
    {"deck": "all", "title": "...", "n": 385,
     "cards": [{"k": "u3-v012:f", "f1": "吖", "f2": "aa4", "b1": "A question word…", "b2": "", "tag": "U3 · Set 1"}, …]}
f1/f2 = front (big line, small line), b1/b2 = back, k = the app's card key (for the "Grade" deep link).
Card order is a fixed shuffle so "next" feels random but rebuilding doesn't churn the files.
"""
import argparse
import json
import os
import random
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "data")
OUT = os.path.join(ROOT, "widget")


def deck_of(v, unit_number):
    if not unit_number:
        return None
    if v.get("fn"):
        return "particles"
    if v.get("section") == "Numbers":
        return "numbers"
    sec = (v.get("section") or "").lower()
    return "vocab" if sec.startswith(("set", "dialogue", "vocabulary")) else None


def card(v, unit, deck):
    tag = f"U{unit['number']}"
    if deck == "vocab":
        tag += " · " + v["section"]
        return {"k": v["id"] + ":f", "f1": v["zh"] or v["jp"], "f2": v["jp"] if v["zh"] else "",
                "b1": v["en"], "b2": v.get("notes", ""), "tag": tag}
    if deck == "particles":
        tag += " · " + ("Ending" if v["fn"] == "ending" else "Particle")
        return {"k": v["id"] + ":p", "f1": v["zh"] or v["jp"], "f2": v["jp"] if v["zh"] else "",
                "b1": v["en"], "b2": v.get("notes", ""), "tag": tag}
    # numbers: say it in Cantonese
    return {"k": v["id"] + ":n", "f1": v["en"], "f2": "say it in Cantonese",
            "b1": v["zh"], "b2": v["jp"], "tag": tag + " · Numbers"}


def build():
    with open(os.path.join(DATA, "index.json"), encoding="utf-8") as f:
        index = json.load(f)
    decks = {"all": [], "particles": [], "numbers": []}
    titles = {"all": "All flashcards", "particles": "Particles & endings", "numbers": "Numbers"}
    for meta in index["units"]:
        p = os.path.join(DATA, meta["file"])
        if not os.path.exists(p):
            continue
        with open(p, encoding="utf-8") as f:
            u = json.load(f)
        unit_cards = []
        for v in u["vocab"]:
            d = deck_of(v, u["number"])
            if not d:
                continue
            c = card(v, u, d)
            unit_cards.append(c)
            decks["all"].append(c)
            if d in ("particles", "numbers"):
                decks[d].append(c)
        if unit_cards:
            key = f"unit-{u['number']}"
            decks[key] = unit_cards
            titles[key] = f"Unit {u['number']} · {u['title']}"
    files = {}
    for name, cards in decks.items():
        cards = list(cards)
        random.Random(name).shuffle(cards)          # fixed shuffle per deck
        files[name + ".json"] = {"deck": name, "title": titles[name], "n": len(cards), "cards": cards}
    files["decks.json"] = {"decks": [{"id": n, "title": titles[n], "n": len(c)} for n, c in decks.items()]}
    return files


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    files = build()
    stale = []
    for name, obj in files.items():
        path = os.path.join(OUT, name)
        text = dump(obj)
        cur = open(path, encoding="utf-8").read() if os.path.exists(path) else None
        if cur != text:
            stale.append(name)
            if not args.check:
                os.makedirs(OUT, exist_ok=True)
                with open(path, "w", encoding="utf-8", newline="\n") as f:
                    f.write(text)
    extra = [f for f in (os.listdir(OUT) if os.path.isdir(OUT) else []) if f.endswith(".json") and f not in files]
    if args.check:
        if stale or extra:
            print("widget decks out of date:", ", ".join(stale + extra), "- run: python tools/build_widget.py")
            sys.exit(1)
        print("widget decks up to date")
        return
    for f in extra:
        os.remove(os.path.join(OUT, f))
    print(f"wrote {len(stale)} of {len(files)} widget files" + (f", removed {extra}" if extra else ""))
    for name in sorted(files):
        if name != "decks.json":
            print(f"  {name:18s} {files[name]['n']:4d} cards")


if __name__ == "__main__":
    main()
