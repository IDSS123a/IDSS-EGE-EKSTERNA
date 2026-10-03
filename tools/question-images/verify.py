#!/usr/bin/env python3
"""Verifies the question crops (P-15): every extracted question has its crop, the crop file matches the manifest hash,
and every word of the question's text regions lies inside the area that was rendered (nothing lost to the header and
footer clip). Exit code 1 on any failure. Usage: python3 tools/question-images/verify.py
"""
import hashlib
import json
import sys
from pathlib import Path

import pymupdf

sys.path.insert(0, str(Path(__file__).parent))
from render import OUTPUT, ROOT, SUBJECTS, body  # noqa: E402

FOOTER_MARK = "Ministarstvo za odgoj"

manifest = json.loads((ROOT / "public" / "catalogue" / "manifest.json").read_text())["questions"]
problems = []
footnotes: dict[str, int] = {}
checked = 0
for subject, pdf_name in SUBJECTS.items():
    records = json.loads((OUTPUT / f"{subject}.questions.json").read_text())["records"]
    with pymupdf.open(ROOT / pdf_name) as document:
        for record in records:
            entry = manifest.get(record["id"])
            if entry is None:
                problems.append(f"{record['id']}: no crop")
                continue
            path = ROOT / "public" / entry["file"].lstrip("/")
            if hashlib.sha256(path.read_bytes()).hexdigest() != entry["png_sha256"]:
                problems.append(f"{record['id']}: crop differs from manifest")
            for region in record["source"]["regions"]:
                page = document[region["page"] - 1]
                area = body(page)
                x0, y0, x1, y1 = region["bbox"]
                for word in page.get_text("words"):
                    inside_region = word[0] >= x0 - 1 and word[2] <= x1 + 1 and word[1] >= y0 - 1 and word[3] <= y1 + 1
                    if inside_region and (word[1] < area.y0 - 0.5 or word[3] > area.y1 + 0.5):
                        # Below the body but above the footer: a footnote (source citation), left out on purpose.
                        footer = [b[1] for b in page.get_text("blocks") if FOOTER_MARK in b[4] and b[1] > page.rect.height * 3 / 4]
                        if word[1] >= area.y1 - 0.5 and (not footer or word[3] <= min(footer) + 0.5):
                            footnotes[record["id"]] = footnotes.get(record["id"], 0) + 1
                        else:
                            problems.append(f"{record['id']}: word {word[4]!r} on page {region['page']} outside the rendered body")
            checked += 1
print(f"{checked} crops checked, {len(problems)} problems")
print(f"footnote text left out of {len(footnotes)} crops: {', '.join(sorted(footnotes))}")
for problem in problems[:50]:
    print("  " + problem)
sys.exit(1 if problems else 0)
