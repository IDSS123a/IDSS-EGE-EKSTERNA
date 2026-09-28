# Sprint 06 — Lessons Learned
Date: 2026-09-27 (closed)

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
8. The first live semantic index build stopped at 100 of 514 with only "Usluga trenutno nije dostupna": Gemini's
   answer was logged on the Director's computer but not shown, and one failing batch stopped everything (found by the
   Director) → external calls report a short, key-free detail to the screen (e.g. "Gemini: 500"), transient server
   errors are retried, and a failing item is isolated and skipped instead of blocking the batch. Every loop over an
   external service is built to survive one bad item and to say which answer it got.
9. The relevance floor for search by meaning (cosine 0.6) was set without looking at the similarity distribution;
   Gemini vectors are all close (unrelated passages 0.74 median), so the query "Ministar" returned unrelated passages
   (found by the Director) → relevance is measured per query (z value against all passages, migration 016) and the
   floor is derived from measured data. A threshold is derived from the measured distribution before it ships, and
   the numbers needed to retune it are recorded from the start.
10. The first practice payload let 40 German Wortschatz items fall back to free text: their options sit at question level
    while the key is per scored item. Found by running the payload function over every live question before any student
    used it; fixed by migration 018. New data-shaped logic is checked against every live record, not only fixtures.
11. All radio groups of a multi-item question shared the name "response", so choosing in one item cleared the others;
    caught while reading the form before the first render → one field name per item.
12. Search quality took three rounds and was still rejected ("Ne valja tražilica. Na nju ćemo se vratiti kasnije."):
    the 0.6 floor let everything through ("Ministar"), the z >= 4 floor then refused "class" and five of the Director's
    six other searches (audit: best passage z 2.7 to 3.9), and the answer model with query translation (PDL-025) shipped
    without one live call. Each round fixed the latest complaint and was never replayed against the earlier queries in
    the audit log or against queries in all three languages. Search is parked as a carry-over; the next attempt starts
    with a test set of 15 to 20 questions in bs/de/en with expected sources, agreed with the Director, run live before
    hand-over.

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
1. AI feature quality (retrieval, answers, generated feedback): a rule that an evaluation set with expected results is
   agreed with the Director before the first version ships, and every later change is replayed against the whole set
   and against the real queries already logged. Tuning to the latest complaint alone repeated the defect three times.
