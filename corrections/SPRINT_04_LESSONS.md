# Sprint 04 — Lessons Learned
Date: 2026-09-27 (closed)

## Corrections Applied
1. The bulk rule confirmation (PDL-016) did not check for existing rule reviews, while the record loop did: the
   Director had confirmed all 20 rules individually minutes earlier, so each rule got a second, tagged
   confirmation that now shows as the latest (append-only, cannot be removed; the individual confirmation stays in
   history) → before any bulk write on behalf of a person, read the current state of every target (records and
   rules alike) and skip what the person already decided.
2. Two hard-coded colours in new review code (canvas outline in TypeScript, page background in CSS) were found only
   at the DONE checklist → moved to `REVIEW_REGION_STROKE` and the `--color-paper` token; new canvas drawing code
   gets its colours from constants from the start.

## Gotchas Discovered
- The rulebook PDF (C2) has a text layer with a broken font encoding: pdf.js returns control characters, not words.
  SOURCE_INVENTORY had listed it as "text layer"; a text layer counts only after its content was read back. Subject
  rows quote the catalogues and cite Art. 5 as legal basis (PDL-015).
- pdf.js 6 modern build calls `Map.prototype.getOrInsertComputed`, missing in the bundled Chromium and in older
  phones, tablets and school PCs; rendering failed with a TypeError that typecheck and build do not see. The browser
  uses `pdfjs-dist/legacy/build` (P-14). Only a real page render in Chromium found it.
- A fixture dev server on the e2e port (3100) survived `kill` of its `npx` parent (the `next-server` child kept
  running); Playwright's `reuseExistingServer` then tested dev mode and reported 4 false CSP failures. Fixture servers
  use another port and are stopped by child PID; the port is checked closed before the suite.
- After a merge the Director's local app keeps running the old code until `git pull` and a dev-server restart; the
  new buttons were "not there". Every hand-off that needs a local click now starts with the pull and restart steps
  and a visible sign of the new version.

## Commander Improvement Candidates
- DONE_CHECKLIST: "any bulk write on behalf of a person reads the current state of every target first and reports
  what it skipped" (a second decision in an append-only history cannot be undone).
- ENGINEERING_RULES (P-14 class of projects): browser-side libraries are verified by a real render in the oldest
  supported engine, not by build success; prefer a library's legacy/compat build for school devices.
- M-4 / hand-off: instructions that need the Director to click in a local app always include pull + restart and a
  "you know it worked when you see X" marker.
