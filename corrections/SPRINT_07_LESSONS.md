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

## Gotchas Discovered
- Six German records (DEU-4.4.10, 4.5.6 to 4.5.10) were never reviewed: their task type was "unclassified", so the Sprint
  04 bulk acceptance skipped them silently. The gap appeared only when the mock exam pool for "Kommunikation" came up
  empty. Pools are now checked against live trusted counts before a blueprint is declared usable.
- The official German key for DEU-4.3.34 is factually wrong (Salzburg "in Deutschland"); a printed key is evidence, not
  truth. Keys are read for plausibility when a task enters auto-checking (AMB-23).
- Chrome ignores `autocomplete="off"` on a field it classifies as a username beside a password field; the
  classification uses the field name and id, so renaming is what works.

## Commander Improvement Candidates
None yet.
