# Sprint 03 — Lessons Learned
Date: 2026-09-27 (open)

## Corrections Applied
1. Sprint 02 was closed with "manual upload, activate and restore of a test PDF worked" and "the Director's test PDF stays archived", taken from the Director's confirmation without checking the database. The live audit log shows five uploads refused as DUPLICATE_FILE and no test version → Sprint 02 record corrected; live claims are verified against `audit_logs` / the data before they are written down (M-4).

## Gotchas Discovered
- pdf.js and PyMuPDF build different line models: pdf.js joins text across tab stops with one synthetic wide space item and puts raised scripts on separate baselines; PyMuPDF splits at wide gaps and keeps scripts inline. Matching needed a gap rule (1.05 font sizes, measured against the largest font of the line) and a script rule (0.55 font sizes); measured, not guessed, over every page of the three catalogues.
- pdf.js cannot tell several real space glyphs from a positioned gap, and it normalises text unless `disableNormalization: true` (which keeps ², ³ and math alphanumerics as encoded).
- pdf.js 6: `PDFDocumentProxy` has no `destroy()`; destroy the loading task. Fonts (and their names, needed for emphasis) are only loaded after `getOperatorList()`.
- JavaScript `\b` is ASCII-only; Python 3 `\b` is Unicode-aware. Ported regexes use a Unicode-letter lookbehind.

- Node on Windows can abort with "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" when a script calls `process.exit()` while handles are closing; set `process.exitCode` and return instead.
- Scripts that read local files must check them before any network call, or a missing file is hidden behind a network error.

## Commander Improvement Candidates
None yet.
