# Sprint 07 — Lessons Learned
Date: 2026-09-27 to 2026-10-03 (closed)

## Corrections Applied
1. The Director signed in as a student, opened practice and expected a test of 18 questions; practice is an endless
   loop by design (PDL-024) and nothing on the screen said so, while the mock exam did not exist yet (found by the
   Director) → the practice screen states that it is practice without end or time limit and that the mock exam is a
   separate part. A mode whose rules differ from what the user expects (exam vs practice) says its rules on screen.
2. Chrome offered "Manage Passwords" in the Username field of the new-account form (found by the Director): the field
   was named `username` next to a password field, so the browser took the administrator's form for its own sign-in,
   and `autocomplete="off"` alone does not stop that → the fields are named `newAccountLogin` / `initialPassword`,
   autocomplete off, password-manager ignore attributes. Forms that create credentials for someone else never use
   sign-in field names.

3. The first submission test expected a teacher notification, but a subject without a teacher would leave a submitted
   mock exam unseen (caught by the DB test) → the superadministrators are notified when the subject has no teacher.
   Every notification path names who receives it when the expected recipient does not exist yet.

4. Earlier designs corrected the canon: text revisions (AMB-19) changed what students read and key revisions (CF-03)
   replaced printed keys; a later recommendation proposed correcting DEU-4.3.34, and the mock exam blueprint added an
   IDSS rule (ten different Math areas). The Director ruled (P-15, PDL-027) that the catalogue is a faithful copy: errors
   are marked, never changed, and no rule is added beyond the canonical documents. Any feature that alters, filters or
   extends canon content is checked against P-15 before it is designed.
5. Students saw plain extracted text: 180 of 200 Math questions without real fractions and exponents, 42 B/H/S questions
   without the highlighted words they ask about. The "requires visual verification" flag was recorded at ingestion but
   never used when showing questions. A data-quality flag must change what the user sees, or it is noise.

6. Sprint IN item 4 (notifications in the app) was implemented in the database only: rows were written for teachers
   and students, but no screen showed them; found by the ACA during the close-out checklist → a notifications panel on
   the student Game Hub and the teacher grading area, with mark as read. Every IN item is checked against what a user
   can see, not against the schema.
7. Removing the text-revision forms (P-15) left the proposal helpers used only by their own unit test (found by the ACA
   at close-out) → removed with the test; `config/text-revision-proposals.json` stays as evidence. When a feature is
   withdrawn, its domain helpers and tests go in the same change.

## Gotchas Discovered
- Six German records (DEU-4.4.10, 4.5.6 to 4.5.10) were never reviewed: their task type was "unclassified", so the Sprint
  04 bulk acceptance skipped them silently. The gap appeared only when the mock exam pool for "Kommunikation" came up
  empty. Pools are now checked against live trusted counts before a blueprint is declared usable.
- The official German key for DEU-4.3.34 is factually wrong (Salzburg "in Deutschland"). Per P-15 the printed key still
  counts; the error is recorded as an erratum and shown as a notice, never corrected (AMB-23).
- Chrome ignores `autocomplete="off"` on a field it classifies as a username beside a password field; the
  classification uses the field name and id, so renaming is what works.

- The Supabase connector holds statements with DROP (even a check constraint of an empty table) for the user's
  confirmation; unanswered, apply_migration and execute_sql time out after 60 s and nothing is applied (the request
  never reaches the database). Migrations with DROP are announced to the Director before they are sent.

- The Director's approval in chat does not answer the Supabase connector's destructive-statement confirmation: in this
  remote session the confirmation never surfaces, so DROP migrations time out even after approval. Such migrations are
  handed to the Director as SQL files for the Supabase SQL editor, and the history row is recorded afterwards.
- Sign-in failures are diagnosed without the password: Supabase auth logs give the error code, and
  `public.security_events` stores SHA-256 of the typed username, so matching it against `profiles.username` shows
  whether a known account was typed (2026-10-03: one wrong password for direktor@idss.ba, two unknown usernames).
- `Intl.NumberFormat("bs")` gave "14,5" on the server and "14.5" in headless Chromium (hydration mismatch). Numbers in
  client components use the deterministic `formatPoints`, never Intl with a locale the browser may lack.
- The PID of `npx next dev` is the wrapper; killing it leaves `next-server` serving the port. Stop both PIDs, found
  through /proc command lines, never with a name-wide pkill.
- A write probe against the live database runs in a DO block that ends with `raise exception`, so everything rolls
  back even without an explicit transaction; check afterwards that nothing stayed.
- Before a Commander upgrade, `git diff vA vB --stat` of the Commander repository shows whether `automation/` changed;
  v1.6.1 to v1.6.2 changed only stamps. The project guard's `--ci` mode waits on stdin; `--scan` reproduces CI.

## Commander Improvement Candidates
- DONE_CHECKLIST: add "every IN item of the sprint is visible to its user (a screen or a message), not only stored in
  the database" (correction 6).
- E-10 / A-1: when a feature is withdrawn by a decision, remove its domain helpers and tests in the same change
  (correction 7).
- Client-rendered numbers and dates: format deterministically or on the server only; Intl locale data differs between
  Node and browsers (gotcha above, hydration).
