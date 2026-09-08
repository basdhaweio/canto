#!/usr/bin/env python
"""Validate data/index.json and every unit file against docs/CONTENT-SCHEMA.md.

Usage: python tools/validate.py            (exit 1 on any error)
"""
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data")
JP = re.compile(r"^[a-z]+[1-6]$")
EX_TYPES = {"reorder", "reply", "fill", "translate", "truefalse", "listen", "open"}
CONF = {"high", "medium", "low", "none"}

errors, warnings = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def check_jp(where, jp):
    if not jp:
        return
    for syl in re.split(r"[\s,/…()（）?!.、:；;=→—>\"“”]+", jp):
        raw = syl.strip()
        syl = raw.lower()
        if not syl or syl in {"x", "y", "-", "…"}:
            continue
        if len(raw) == 1 and raw.isalpha():          # speaker labels A / B
            continue
        if raw[0].isupper() and not re.search(r"[1-6]", raw):   # English names (Peter, Jenny)
            continue
        if syl.isdigit():
            continue
        if not JP.match(syl):
            warn(f"{where}: odd Jyutping syllable '{syl}' in '{jp}'")


def check_unit(path, meta):
    with open(path, encoding="utf-8") as f:
        u = json.load(f)
    uid = u.get("id")
    if uid != meta["id"]:
        err(f"{path}: id {uid} != index {meta['id']}")
    prefix = f"u{u.get('number')}-"
    ids = set()

    def reg(i, where):
        if not isinstance(i, str) or not i.startswith(prefix):
            err(f"{where}: bad id {i!r} (expected prefix {prefix})")
        if i in ids:
            err(f"{where}: duplicate id {i}")
        ids.add(i)

    for k in ("vocab", "dialogues", "grammar", "exercises", "notes", "goals", "sources"):
        if not isinstance(u.get(k), list):
            err(f"{uid}: '{k}' missing or not a list")
    for v in u.get("vocab", []):
        reg(v.get("id"), f"{uid} vocab")
        if not v.get("jp"):
            err(f"{uid} {v.get('id')}: vocab missing jp")
        if not v.get("en"):
            err(f"{uid} {v.get('id')}: vocab missing en")
        check_jp(f"{uid} {v.get('id')}", v.get("jp", ""))
    for d in u.get("dialogues", []):
        reg(d.get("id"), f"{uid} dialogue")
        if not d.get("lines"):
            err(f"{uid} {d.get('id')}: dialogue has no lines")
        for line in d.get("lines", []):
            reg(line.get("id"), f"{uid} {d.get('id')} line")
            if not line.get("jp"):
                warn(f"{uid} {line.get('id')}: line missing jp")
            check_jp(f"{uid} {line.get('id')}", line.get("jp", ""))
    for g in u.get("grammar", []):
        reg(g.get("id"), f"{uid} grammar")
        if not g.get("title"):
            err(f"{uid} {g.get('id')}: grammar missing title")
        for e in g.get("examples", []):
            reg(e.get("id"), f"{uid} {g.get('id')} example")
            check_jp(f"{uid} {e.get('id')}", e.get("jp", ""))
    for x in u.get("exercises", []):
        reg(x.get("id"), f"{uid} exercise")
        if x.get("type") not in EX_TYPES:
            err(f"{uid} {x.get('id')}: bad type {x.get('type')!r}")
        for it in x.get("items", []):
            reg(it.get("id"), f"{uid} {x.get('id')} item")
            if it.get("confidence") not in CONF:
                err(f"{uid} {it.get('id')}: bad confidence {it.get('confidence')!r}")
            if it.get("answer") and it.get("confidence") == "none":
                warn(f"{uid} {it.get('id')}: has answer but confidence none")
    for n in u.get("notes", []):
        reg(n.get("id"), f"{uid} note")
    return {k: len(u.get(k, [])) for k in ("vocab", "dialogues", "grammar", "exercises", "notes")}


def main():
    with open(os.path.join(ROOT, "index.json"), encoding="utf-8") as f:
        idx = json.load(f)
    seen = set()
    for meta in idx["units"]:
        if meta["id"] in seen:
            err(f"index: duplicate unit id {meta['id']}")
        seen.add(meta["id"])
        p = os.path.join(ROOT, meta["file"])
        if not os.path.exists(p):
            warn(f"{meta['id']}: file {meta['file']} not present yet")
            continue
        try:
            counts = check_unit(p, meta)
            print(f"{meta['id']:8s} {meta['title']:28s} " + "  ".join(f"{k}={v}" for k, v in counts.items()))
        except json.JSONDecodeError as e:
            err(f"{p}: invalid JSON: {e}")
    with open(os.path.join(ROOT, idx["syllabus"]), encoding="utf-8") as f:
        json.load(f)
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    print(f"\n{len(errors)} errors, {len(warnings)} warnings")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
