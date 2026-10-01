#!/usr/bin/env python
"""Render the Android adaptive-icon foreground (粵 in gold) from the same font as icons/icon-*.png.

Usage: python tools/android_icons.py
Writes android/app/src/main/res/drawable-nodpi/ic_launcher_fg.png (432x432 = 108dp at xxxhdpi), glyph kept inside
the 66dp safe zone so launchers can mask it to any shape. Needs Pillow and a CJK font (Windows: Microsoft YaHei).
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "android", "app", "src", "main", "res", "drawable-nodpi", "ic_launcher_fg.png")
FONTS = [r"C:\Windows\Fonts\msyh.ttc", r"C:\Windows\Fonts\msyhbd.ttc", r"C:\Windows\Fonts\simhei.ttf",
         "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"]


def main():
    font_path = next((f for f in FONTS if os.path.exists(f)), None)
    if not font_path:
        raise SystemExit("no CJK font found")
    size = 432
    safe = int(size * 66 / 108)                 # 264 px
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(font_path, int(safe * 0.9))
    glyph = "粵"
    box = d.textbbox((0, 0), glyph, font=font)
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((size - w) / 2 - box[0], (size - h) / 2 - box[1]), glyph, font=font, fill=(200, 151, 74, 255))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    img.save(OUT)
    print("wrote", OUT)


if __name__ == "__main__":
    main()
