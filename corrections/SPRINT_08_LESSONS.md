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
