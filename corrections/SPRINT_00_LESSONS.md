# Sprint 00 — Lessons Learned
Date: 2026-09-27

## Corrections Applied
- Math area heading "5.10." is split over two PDF text lines → area names were mis-assigned to 5.9 → heading detection now joins a bare number line with the next line → M-4 (verify with a second method: per-area counts 20×10).
- German item parser assumed "1. text" on one line; Leseverstehen prints "1." and the statement on separate lines, Kommunikation uses blanks and 1)–3) choices → dedicated parsers; per-area counts now 40/40/40/40/40 → M-4.
- B/H/S "istaknute riječi" questions depend on bold text → emphasis spans are now preserved in the syntax layer → mandate §0 syntax level.
- Inventory initially claimed the two EM11 files were byte-identical → md5 differs → corrected → M-4 (second method).

## Gotchas Discovered
- Several ministry PDFs are image-only (Uputstvo 2026, Instrukcija 2026, gazette amendments); `3.a` has a text layer with broken font encoding — OCR is required, and text-layer presence ≠ usable text.
- `3.a`/`3.b` "Pravilnik o izmjenama" files are full gazette issues; the relevant amendment is on inner pages.
- The official logo URL (idss.edu.ba) is blocked by the cloud build environment's egress policy.
- Commander automation install (clone of executable code from `commander` tag) is blocked by the cloud session's safety policy.

## Commander Improvement Candidates
- initial_instructions Step 2: when a project mandate already answers the five bootstrap questions, the ACA should record the answers from the mandate instead of asking (C-6) — make this explicit.
- Add to E-4/DONE: "Before first commit, check whether the repository is public and whether tracked files contain personal data of minors" — discovered here on an existing public repo.
- Step 3.3 needs a documented fallback for cloud ACAs that may not execute externally fetched code: produce the file list + one command for the Director (like the no-filesystem fallback).
