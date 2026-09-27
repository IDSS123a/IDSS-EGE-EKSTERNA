# Sprint 03 — Lessons Learned
Date: 2026-09-27 (closed)

## Corrections Applied
1. Sprint 02 was closed with "manual upload, activate and restore of a test PDF worked" and "the Director's test PDF stays archived", taken from the Director's confirmation without checking the database. The live audit log showed five uploads refused as DUPLICATE_FILE and no test version → Sprint 02 record corrected; live claims are now verified against `audit_logs` or the data before they are written down (M-4). Applied at the Sprint 03 close: the extraction counts were confirmed by an MD5 fingerprint of IDs and answer keys computed in the database and in the reference.
2. `canon:seed` hid a missing local catalogue behind a network error and exited with `process.exit()`, which aborted on Windows (libuv assertion) → local files are checked before any network call with a `git restore` hint; the script sets `process.exitCode`.
3. A JSON edit put unescaped quotes inside a string in `tools/canon-seed/catalogues.json` → caught by parsing the file before commit; generated JSON edits are always parsed back.

## Gotchas Discovered
- pdf.js and PyMuPDF build different line models: pdf.js joins text across tab stops with one synthetic wide space item and puts raised scripts on separate baselines; PyMuPDF splits at wide gaps and keeps scripts inline. Matching needed a gap rule (1.05 font sizes, measured against the largest font of the line) and a script rule (0.55 font sizes), measured over every page of the three catalogues, not guessed.
- pdf.js cannot tell several real space glyphs from a positioned gap, and it normalises text unless `disableNormalization: true` (which keeps ², ³ and math alphanumerics as encoded).
- pdf.js 6: `PDFDocumentProxy` has no `destroy()` (destroy the loading task); font names, needed for emphasis, are only available after `getOperatorList()`; the package must be in `serverExternalPackages` so its worker module resolves at run time.
- JavaScript `\b` is ASCII-only while Python 3 `\b` is Unicode-aware: ported regexes use a Unicode-letter lookbehind.
- Scanned ministry documents (web-page prints, stamped decisions) have no text layer; they are read visually and never ingested without an OCR decision.

## Commander Improvement Candidates
- ENGINEERING_RULES / DONE_CHECKLIST: when porting a parser to another library, keep the old outputs as a golden reference and gate the port on a record-level regression test (identity, keys, structure) plus an independent fingerprint check on live data.
- DONE_CHECKLIST: "Live verification" must name the evidence (audit rows, query result, fingerprint), not only the Director's confirmation.
- ARCHITECTURE_PATTERNS: append-only "job + records" pattern for derived data (one-transaction write function, dependency map rows so superseding the source marks derivatives stale).
