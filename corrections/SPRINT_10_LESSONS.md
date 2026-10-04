# Sprint 10 — Lessons Learned
Date: 2026-10-04 (open)

## Corrections Applied
None yet.

## Gotchas Discovered
- In a validation `jsonb_typeof(x) <> 'number'` is NULL when the key is missing, so `exists (... where ... <> ...)` let
  an incomplete IDSS points object through; the DB test caught it. Validations use `is distinct from`.
- React lint rule `react-hooks/error-boundaries` refuses JSX built inside try/catch in a server page; load the data in
  a helper inside try/catch and render after it.
- After removing a temporary preview route, `.next/dev/types` still references it and `tsc` fails; delete
  `.next/dev/types` (generated) before the typecheck.

## Commander Improvement Candidates
None yet.
