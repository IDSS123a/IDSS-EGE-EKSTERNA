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
