# Sprint 06 — Lessons Learned
Date: 2026-09-27 (open)

## Corrections Applied
1. Account administration forbade changing one's own account (no self-lockout) and there was no self-service password
   change, so administrators could not change their own password; found by the Director → `/app/nalog` for every account.
   Every role's own-account basics (password, name) are checked against the role list when a sprint adds accounts.
2. The hand-off "Pregled, Matematika, open MAT-5.3.5" could not be followed: the queue opens on "waiting" records,
   all 200 Math records were accepted, so the list was empty and a record could only be found by paging (found by
   the Director) → the queue shows everything when nothing waits, finds records by code, and lists open text
   proposals with direct links. A hand-off that names records is checked by following it on the real screen.
3. Links styled as `.button-secondary` had no centring (the class was written for `<button>`), so "Moj nalog" on the
   home page showed its text at the top edge (found by the Director) → the class centres its label for links too.
4. Splash calibration measured the card as "yellow": the measuring script lived in the scratchpad and its step that
   hides card, grain and veil was not carried over. Tools that produce committed data live in the repository.
5. The first splash was an "IDSS-native re-implementation of the principles" of the reference, and every later
   palette request moved it further from the look the Director had approved; the Director then sent the reference
   file again ("veoma sam bio zadovoljan s ovim rješenjem") → the reference FLOW algorithm is ported exactly, and the
   shares become its colour weights, fitted by measuring the same formula on the server (PDL-022). When a reference
   is approved, port its algorithm; do not approximate it.
6. The text-correction form was shown open on every accepted question and accepted an unchanged text; the Director
   saved four revisions identical to the catalogue text (MAT-5.3.7 to 5.3.10, append-only, harmless) → the database
   refuses UNCHANGED (migration 014) and the form stays folded unless a proposal exists. A form that writes to an
   append-only history refuses no-op writes on the server.
7. Two lint warnings (unused parameters in a test helper) reached `main` with PR #29: lint had run before the last
   test file was written, and the later check filtered only for errors → the final lint runs after the last edit,
   and warnings count as findings. Found by ACA while adding key rotation, fixed in PR #30.

## Gotchas Discovered
- Browser textareas submit line breaks as \r\n; the first live revisions stored \r\n while the catalogue text uses \n.
  Text written from forms is normalised before it is stored or compared (migration 014, `normalizeLineBreaks`).
- A WebGL canvas cannot be read back after drawing (no `preserveDrawingBuffer`): colour measurements of the splash
  returned zeros until they were taken from screenshots.
- React writes `style={{...}}` into server-rendered HTML as a style attribute, which the nonce CSP blocks; dynamic
  sizes are set through the CSSOM after render, colours through classes.
- AMB-19 listed DEU-4.2.5 among the footnote cases because its text contains a web address; the source page shows
  `www.musikwettbewerb.de` at text size inside the reading text, while footnotes are 8 pt at the page bottom. A text
  is classified as a footnote only after its font size and position were read from the page.
- `pkill -f next` / `kill $(pgrep -f next-server)` in the same shell matched the shell's own command line and killed
  it (exit 144); dev servers are stopped by the PID written when they start.
- The Gemini docs site is blocked from the sandbox; the model was verified through search results (release notes,
  issue trackers). `gemini-embedding-2` ignores `taskType`: the task instruction must be written into the text,
  otherwise retrieval quality silently drops.
- pgvector is not in the sandbox PostgreSQL by default (`apt-get install postgresql-16-pgvector`), and the Supabase
  stub needs schema `extensions` with usage for the API roles; `scripts/test-db.sh` now says so when it is missing.
- Gemini keys are read from the environment at server start: after adding GEMINI_API_KEY_1 to _10 to `.env.local`, the
  dev server must be restarted before the keys are seen.

## Commander Improvement Candidates
None yet.
