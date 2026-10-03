# Sprint 09 — Lessons Learned
Date: 2026-10-03 (open)

## Corrections Applied
1. Sprint 08 replaced the stale home status texts in a docs commit and ran only Vitest and check:text, not the e2e
   suite; the language-switch test still expected "Die Plattform ist im Aufbau" and failed (found by the ACA in Sprint
   09; CI runs only the project guard and the text rule, so it did not catch it). Fixed the expectation. Any change to
   app text runs the e2e suite before the push, because e2e tests assert visible texts.

## Gotchas Discovered
- A Supabase migration of 22 KB is applied through the connector in parts (helpers and table, profile functions,
  analysis) to stay below the connector's time limit; every part is idempotent (`create or replace`).

## Commander Improvement Candidates
None yet.
