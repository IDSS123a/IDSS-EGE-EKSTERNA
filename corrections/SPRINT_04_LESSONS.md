# Sprint 04 — Lessons Learned
Date: 2026-09-27 (open)

## Corrections Applied
1. The bulk rule confirmation (PDL-016) did not check for existing rule reviews, while the record loop did: the
   Director had confirmed all 20 rules individually minutes earlier, so each rule got a second, tagged
   confirmation that now shows as the latest (append-only, cannot be removed; the individual confirmation stays in
   history) → before any bulk write on behalf of a person, read the current state of every target (records and
   rules alike) and skip what the person already decided.

## Gotchas Discovered
- pdf.js 6 modern build (`pdfjs-dist/build`) calls `Map.prototype.getOrInsertComputed`, which the bundled Chromium (and older phones, tablets, school PCs) lacks: rendering failed with a TypeError. The browser uses `pdfjs-dist/legacy/build` (P-14: every device). Found by rendering a real catalogue page in Chromium, not by typecheck or build.
- A dev server started for a fixture check on the e2e port (3100) survived `kill` of its `npx` parent (the `next-server` child kept running); Playwright's `reuseExistingServer` then ran the suite against dev mode and reported 4 false CSP failures. Fixture servers use another port and are stopped by the child PIDs; the suite is re-run after `curl` shows the port closed.
- The rulebook PDF (C2, `3. Pravilnik_o_polaganju_eksterne_mature.pdf`) has a text layer with a broken
  font encoding: pdf.js returns control characters, not words. SOURCE_INVENTORY listed it as "text layer";
  a text layer is only usable after its content has been read back. Subject rows therefore quote the
  catalogues (text layer verified) and cite Art. 5 as legal basis (PDL-015).

## Commander Improvement Candidates
None yet.
