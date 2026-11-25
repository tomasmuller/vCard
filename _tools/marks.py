"""The loose marks of tomasmuller.dev: the acute of "á" and the two dots of "ü".

The page draws these three shapes itself, so that the string can throw them. This prints
their outlines, taken from the font at the exact settings the name is set in.

    python3 _tools/marks.py       prints the table that index.html embeds
    node --test                   checks that the table was made from the page as it is now

Everything is read from index.html: the name, its weight, roundness and optical size, and
the font file. Run this again whenever one of those changes, because the marks change
shape and position with every axis. The first line it prints records the settings and a
fingerprint of the font file, and the test fails when either no longer matches.

Needs fontTools with Brotli:  pip install fonttools brotli
"""

import hashlib
import re
import sys
import unicodedata
from pathlib import Path

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Identity
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent


def find(pattern, text, what):
    found = re.search(pattern, text, re.S)
    if not found:
        sys.exit(f"Cannot find {what} in index.html. If the page changed, update page_facts() in marks.py.")
    return found.group(1)


def page_facts(html):
    """The name, the font file and the variation settings, as index.html states them.
    The settings keep the page's own spelling, so the test can compare them as text."""
    name = re.sub(r"<[^>]+>", "", find(r"<h1[^>]*>(.*?)</h1>", html, "the name in an <h1>"))
    font = find(r"url\((fonts/[^)]+\.woff2)\)", html, "the font file")
    rule = find(r"\n\s*\.name \{(.*?)\}", html, "the .name rule")
    where = {"wght": find(r"font-weight: (\d+)", rule, "a font-weight in the .name rule")}
    settings = find(r"font-variation-settings: ([^;]+);", rule, "font-variation-settings in the .name rule")
    where.update(re.findall(r'"(\w{4})" ([\d.]+)', settings))
    return name, font, where


def number(value):
    return f"{value:.1f}".rstrip("0").rstrip(".")


def marks_of(font, letter):
    """One SVG path per mark on a letter, left to right: font units, y down, measured
    from the origin of the plain letter on the baseline. Each contour is a mark of its
    own, like each dot of "ü", except one inside another: that is a hole, as in the ring
    of "å", and stays in the path of the contour around it. Returns (plain letter, paths)."""
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    plain = unicodedata.normalize("NFD", letter)[0]
    for needed in (letter, plain):
        if ord(needed) not in cmap:
            sys.exit(f'The font has no "{needed}". Add it to the subset (README.md).')
    glyph = font["glyf"][cmap[ord(letter)]]
    if not glyph.isComposite():
        sys.exit(f'"{letter}" is one outline in this font, not "{plain}" plus marks.')
    parts = [part.getComponentInfo() for part in glyph.components]
    # Glyph names change with every subset, so the base is found by its letter, not by name.
    base = next((shift for glyph, shift in parts if glyph == cmap[ord(plain)]), None)
    if base is None:
        sys.exit(f'"{letter}" is not built from "{plain}" plus marks in this font.')
    contours = []  # (box, steps, transform)
    for glyph, shift in parts:
        if glyph == cmap[ord(plain)]:
            continue
        # Into the letter's own space, then y down as SVG has it.
        place = Identity.scale(1, -1).translate(-base[4], -base[5]).transform(shift)
        record = DecomposingRecordingPen(glyphs)
        glyphs[glyph].draw(record)
        steps = []
        for step in record.value:
            steps.append(step)
            if step[0] in ("closePath", "endPath"):
                xs, ys = zip(*(place.transformPoint(point) for _, args in steps for point in args if point))
                contours.append(((min(xs), min(ys), max(xs), max(ys)), steps, place))
                steps = []

    def within(i, j):
        """Whether contour i lies inside contour j's box (of two equal boxes, the later one)."""
        a, b = contours[i][0], contours[j][0]
        return i != j and b[0] <= a[0] and b[1] <= a[1] and a[2] <= b[2] and a[3] <= b[3] and (a != b or i > j)

    marks = {i: [i] for i in range(len(contours)) if not any(within(i, j) for j in range(len(contours)))}
    for i in range(len(contours)):
        if i not in marks:
            marks[next(j for j in marks if within(i, j))].append(i)
    paths = []
    for _, members in sorted(marks.items(), key=lambda mark: contours[mark[0]][0][0]):
        path = SVGPathPen(glyphs, ntos=number)
        for i in members:
            _, steps, place = contours[i]
            pen = TransformPen(path, place)
            for method, args in steps:
                getattr(pen, method)(*args)
        paths.append(path.getCommands())
    return plain, paths


def main():
    name, file, where = page_facts((ROOT / "index.html").read_text(encoding="utf-8"))
    place = {axis: float(value) for axis, value in where.items()}
    font = instancer.instantiateVariableFont(TTFont(ROOT / file), place)

    at = ", ".join(f"{axis} {value}" for axis, value in where.items())
    print_of = hashlib.sha256((ROOT / file).read_bytes()).hexdigest()[:12]
    print(f"        // Generated by _tools/marks.py at {at}, font sha256 {print_of}.")
    print(f"        const EM = {font['head'].unitsPerEm};")
    print("        const MARKS = {")
    for letter in dict.fromkeys(name):
        if unicodedata.normalize("NFD", letter) == letter:
            continue
        plain, paths = marks_of(font, letter)
        print(f"          {letter}: ['{plain}', " + ", ".join(f"'{path}'" for path in paths) + "],")
    print("        };")


if __name__ == "__main__":
    main()
