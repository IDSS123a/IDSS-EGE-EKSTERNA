# Sprint 08 — Lessons Learned
Date: 2026-10-03 (open)

## Corrections Applied
None yet.

## Gotchas Discovered
- A Python `rstrip("});")` strips any of those characters, not the suffix, and cut a test file's closing braces
  (Vitest: "no tests"). Edit file endings by exact string replacement, never by character-set strip.
- Gamification values (XP per event, badge thresholds) are not in the mandate; like the daily mission (PDL-024) they
  are a Director decision recorded before implementation, not a developer default.

## Commander Improvement Candidates
None yet.

### 2026-10-03 - Plan-gated platform features
- Supabase leaked-password protection is a Pro-plan feature; the dashboard switch fails on Free. A security control
  the platform gates behind a plan is rebuilt in the application when it is cheap and privacy-safe (here: Pwned
  Passwords range API with k-anonymity, PDL-030), and the advisor WARN is recorded as mitigated, not ignored.
- The build sandbox cannot reach api.pwnedpasswords.com (egress policy); such checks are tested with a fake service
  and fail open with a log entry, so an unreachable service never blocks a password change.

### 2026-10-03 - XP derived, not stored
- XP computed read-only from the facts it rewards (answers with their latest outcome, days, exams) cannot drift from
  them and cannot touch a score: a teacher's later verdict changes the XP of that answer automatically, and a
  `stable` function is proven unable to write (DB test). A separate ledger is only needed once XP must survive a change
  of the facts.
- `next dev` reports inline-style CSP errors on every page (33 on the login page too): they come from the dev tooling,
  not from new code; console checks for new screens compare against the login page or run on the production build.

### 2026-10-03 - Writing the user guide finds stale screens
- Writing the guide against the real labels found two stale texts still shown to users (public home: "Trenutno se
  gradi Sprint 02"; staff home: workspace "se gradi"). Status texts that name a sprint go stale silently; app texts
  describe what the user can do, never the project's progress. The guide is updated in the same change as its screen
  (PDL-031), which keeps catching such drift.
- Staff analytics must not invent thresholds: "students needing attention" is offered as filters the user sets (N
  days without practice, a drop against the student's own previous exam), not as a system label (P-4, mandate §11).
