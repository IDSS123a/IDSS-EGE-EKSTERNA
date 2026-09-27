# Sprint 03 — Lessons Learned
Date: 2026-09-27 (open)

## Corrections Applied
None yet.

## Gotchas Discovered
- pdf.js and PyMuPDF build different line models: pdf.js joins text across tab stops with one synthetic wide space item and puts raised scripts on separate baselines; PyMuPDF splits at wide gaps and keeps scripts inline. Matching needed a gap rule (1.05 font sizes, measured against the largest font of the line) and a script rule (0.55 font sizes); measured, not guessed, over every page of the three catalogues.
- pdf.js cannot tell several real space glyphs from a positioned gap, and it normalises text unless `disableNormalization: true` (which keeps ², ³ and math alphanumerics as encoded).
- pdf.js 6: `PDFDocumentProxy` has no `destroy()`; destroy the loading task. Fonts (and their names, needed for emphasis) are only loaded after `getOperatorList()`.
- JavaScript `\b` is ASCII-only; Python 3 `\b` is Unicode-aware. Ported regexes use a Unicode-letter lookbehind.

## Commander Improvement Candidates
None yet.
