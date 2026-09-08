#!/usr/bin/env python
"""Render a course PDF to page images + a text-layer dump, ready for transcription.

Usage:
    python tools/extract_pdf.py "C:/path/Unit 9 Health.pdf" [more.pdf ...] [--out DIR]

Output (per PDF, in --out, default ./work/<slug>/):
    p01.png, p02.png, ...   page renders (1.6x scale)
    text.txt                pdfplumber text per page (layout is scrambled for tables,
                            but characters and Jyutping are exact -- use it to verify)

Requires: pip install pypdfium2 pdfplumber pillow
"""
import argparse
import os
import re
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdfs", nargs="+")
    ap.add_argument("--out", default="work")
    ap.add_argument("--scale", type=float, default=1.6)
    args = ap.parse_args()
    try:
        import pypdfium2 as pdfium
        import pdfplumber
    except ImportError:
        sys.exit("pip install pypdfium2 pdfplumber pillow")
    for pdf_path in args.pdfs:
        name = os.path.splitext(os.path.basename(pdf_path))[0]
        slug = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
        d = os.path.join(args.out, slug)
        os.makedirs(d, exist_ok=True)
        pdf = pdfium.PdfDocument(pdf_path)
        for i in range(len(pdf)):
            pdf[i].render(scale=args.scale).to_pil().save(os.path.join(d, f"p{i + 1:02d}.png"))
        with pdfplumber.open(pdf_path) as pp, open(os.path.join(d, "text.txt"), "w", encoding="utf-8") as f:
            for i, page in enumerate(pp.pages):
                f.write(f"\n===== PAGE {i + 1} =====\n{page.extract_text() or ''}\n")
        print(f"{slug}: {len(pdf)} pages -> {d}")


if __name__ == "__main__":
    main()
