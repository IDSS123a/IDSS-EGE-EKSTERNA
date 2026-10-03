#!/usr/bin/env python3
"""Question crops (P-15, PDL-027): every catalogue question is shown to students and teachers exactly as printed.

Renders the source region(s) of every extracted catalogue question from the stored catalogue PDF (repository root)
to a grayscale PNG under public/catalogue/<first 12 hex of the PDF SHA-256>/<record key>.png, regions of one question
stacked top to bottom, and writes public/catalogue/manifest.json (record key -> file, PDF SHA-256, pages, regions,
PNG SHA-256) as provenance. The regions are the ones the review compared with the page (identical to the live
question versions). Solutions are printed in separate catalogue sections, so a crop never shows a key.

Usage: python3 tools/question-images/render.py   (needs PyMuPDF, see tools/canon-ingestion/requirements.txt)
"""
import hashlib
import json
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "tools" / "canon-ingestion" / "output"
TARGET = ROOT / "public" / "catalogue"
SUBJECTS = {
    "bhs_language_literature": "Ispitni katalog za BHS jezik.pdf",
    "mathematics": "Ispitni katalog za Matematika.pdf",
    "german": "Ispitni katalog za Njemački jezik.pdf",
}
# 2x the PDF resolution (144 dpi): sharp on phones, about 33 KB per question.
SCALE = 2
# Margin around a region in PDF points, so no glyph is clipped.
MARGIN_X, MARGIN_Y = 6, 4
# Page header (running title "EKSTERNA MATURA ...") and footer ("Ministarstvo za odgoj i obrazovanje ...", page
# number) never belong to a question; their position is read from each page.
HEADER_MARK, FOOTER_MARK = "EKSTERNA MATURA", "Ministarstvo za odgoj"
# Graphics smaller than this (points, both sides) are rules or bullets, not figures.
MIN_FIGURE_SIDE = 12


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def is_footnote_rule(page: pymupdf.Page, rule: pymupdf.Rect, bottom: float) -> bool:
    """A footnote rule: everything below it, down to the footer, starts with a footnote number in small type."""
    lines = [line for block in page.get_text("dict")["blocks"] for line in block.get("lines", [])
             if rule.y1 <= line["bbox"][1] < bottom and line["spans"]]
    if not lines:
        return False
    first = min(lines, key=lambda line: line["bbox"][1])["spans"]
    return first[0]["text"].strip()[:1].isdigit() and max(span["size"] for line in lines for span in line["spans"]) <= 10


def body(page: pymupdf.Page) -> pymupdf.Rect:
    """The page without its running header and footer."""
    blocks = page.get_text("blocks")
    top, bottom = page.rect.y0, page.rect.y1
    header = [b for b in blocks if b[4].lstrip().startswith(HEADER_MARK) and b[1] < page.rect.height / 4]
    if header:
        # The running title may wrap: every block that starts inside the title's band belongs to it.
        top = max(b[3] for b in blocks if b[1] < header[0][3] - 2)
    footer = [b for b in blocks if FOOTER_MARK in b[4] and b[1] > page.rect.height * 3 / 4]
    if footer:
        bottom = min(b[1] for b in footer)
        # The page-number box is drawn a little above the footer text: it belongs to the footer too.
        boxes = [pymupdf.Rect(d["rect"]) for d in page.get_drawings()]
        bottom = min([bottom] + [r.y0 for r in boxes if r.y0 > page.rect.height * 3 / 4 and r.y1 >= bottom])
    # Footnotes (source citations under a short rule in the lower half) are page apparatus, not question content.
    rules = [pymupdf.Rect(d["rect"]) for d in page.get_drawings()]
    rules = [r for r in rules if r.height < 2 and 60 <= r.width < page.rect.width / 2 and page.rect.height / 2 < r.y0 < bottom
             and is_footnote_rule(page, r, bottom)]
    if rules:
        bottom = min(r.y0 for r in rules) - 1.5
    return pymupdf.Rect(page.rect.x0, top, page.rect.x1, bottom)


def figures(page: pymupdf.Page) -> list[pymupdf.Rect]:
    """Drawings and embedded images of the page body, without hairlines."""
    rects = [pymupdf.Rect(drawing["rect"]) for drawing in page.get_drawings()]
    rects += [pymupdf.Rect(info["bbox"]) for info in page.get_image_info()]
    area = body(page)
    return [r for r in rects if r.y0 >= area.y0 and r.y1 <= area.y1 and (r.width >= MIN_FIGURE_SIDE or r.height >= MIN_FIGURE_SIDE)]


def clip_for(page: pymupdf.Page, bbox: list[float], next_top: float | None) -> pymupdf.Rect:
    """The text region plus every figure that starts between the region's top and the next question on the page:
    the extracted regions cover text only, while a question's drawing sits beside or below it (e.g. MAT-5.9.11)."""
    x0, y0, x1, y1 = bbox
    rect = pymupdf.Rect(x0, y0, x1, y1)
    area = body(page)
    limit = next_top if next_top is not None else area.y1
    for figure in figures(page):
        if figure.y0 >= y0 - MARGIN_Y and figure.y0 < limit:
            rect |= figure & pymupdf.Rect(page.rect.x0, y0 - MARGIN_Y, page.rect.x1, limit)
    return pymupdf.Rect(rect.x0 - MARGIN_X, rect.y0 - MARGIN_Y, rect.x1 + MARGIN_X, rect.y1 + MARGIN_Y) & area


def stacked(document: pymupdf.Document, regions: list[dict], next_tops: list[float | None]) -> pymupdf.Pixmap:
    parts = []
    for region, next_top in zip(regions, next_tops):
        page = document[region["page"] - 1]
        clip = clip_for(page, region["bbox"], next_top)
        parts.append(page.get_pixmap(matrix=pymupdf.Matrix(SCALE, SCALE), clip=clip, colorspace=pymupdf.csGRAY, alpha=False))
    if len(parts) == 1:
        return parts[0]
    width = max(part.width for part in parts)
    height = sum(part.height for part in parts)
    canvas = pymupdf.Pixmap(pymupdf.csGRAY, pymupdf.IRect(0, 0, width, height), False)
    canvas.clear_with(255)
    top = 0
    for part in parts:
        part.set_origin(0, top)
        canvas.copy(part, part.irect)
        top += part.height
    return canvas


def main() -> None:
    manifest = {"_about": __doc__.strip().splitlines()[0], "scale": SCALE, "questions": {}}
    for subject, pdf_name in SUBJECTS.items():
        pdf = ROOT / pdf_name
        digest = sha256(pdf)
        folder = TARGET / digest[:12]
        folder.mkdir(parents=True, exist_ok=True)
        records = json.loads((OUTPUT / f"{subject}.questions.json").read_text())["records"]
        # Top of every question region per page, to know where the next question starts.
        tops: dict[int, list[float]] = {}
        for record in records:
            for region in record["source"]["regions"]:
                tops.setdefault(region["page"], []).append(region["bbox"][1])
        with pymupdf.open(pdf) as document:
            for record in records:
                regions = record["source"]["regions"]
                next_tops = [min((top for top in tops[r["page"]] if top > r["bbox"][1] + 1), default=None) for r in regions]
                path = folder / f"{record['id']}.png"
                stacked(document, regions, next_tops).save(path)
                manifest["questions"][record["id"]] = {
                    "file": f"/catalogue/{digest[:12]}/{record['id']}.png",
                    "pdf_sha256": digest,
                    "pages": sorted({region["page"] for region in regions}),
                    "regions": regions,
                    "png_sha256": sha256(path),
                }
    (TARGET / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(manifest['questions'])} questions rendered")


if __name__ == "__main__":
    main()
