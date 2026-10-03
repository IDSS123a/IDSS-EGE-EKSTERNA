# Sprint 07 — Lessons Learned
Date: 2026-09-27 (open)

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

## Commander Improvement Candidates
None yet.

### 2026-10-03 — No lessons this session (routine changes only: migrations 022/023 verified live, history rows recorded)

### 2026-10-03 - Sign-in failure diagnosis
- When a staff member cannot sign in, the cause is found without asking for the password: Supabase auth logs give the
  error code (invalid_credentials), and public.security_events stores SHA-256 of the typed username, so matching it
  against profiles.username shows whether a known account was typed. On 2026-10-03 one attempt named
  direktor@idss.ba with a wrong password, two named no account at all; the account itself was active and not locked.

### 2026-10-03 - Locale formatting in client components
- `Intl.NumberFormat("bs")` gave "14,5" on the server (Node with full ICU) and "14.5" in headless Chromium, which
  caused a hydration mismatch on the mock exam overview. Numbers shown by client components are formatted by a small
  deterministic function (`formatPoints`), not by Intl with a locale the browser may lack.

### 2026-10-03 - Stopping a preview dev server
- The PID saved for `npx next dev` is the npx wrapper; killing it leaves `next-server` serving the port (a 500 after
  the preview page is deleted). Stop the dev server by the PIDs of both processes found through /proc command lines,
  never with a name-wide pkill.
- A write probe against the live database runs inside a DO block that ends with `raise exception`, so the whole block
  rolls back even when the SQL tool does not keep an explicit transaction open; check afterwards that nothing stayed.

### 2026-10-03 - Commander upgrade check
- Before upgrading Commander, diff the two tags of the Commander repository (`git diff vA vB --stat`): when
  `automation/` is unchanged apart from the template's version line, the upgrade is a version stamp plus a decision
  entry, and nothing installed under `.claude/` or `.github/` needs replacing.
- The project guard's `--ci` mode waits for hook input on stdin; run `--scan` locally to reproduce the CI step.
