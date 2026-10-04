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

- 2026-10-04: the Director saw the error page on `/app` after pulling Sprint 10. Supabase logs showed every request of
  his session answered 200 and the same staff home rendered cleanly here, so the fault was local: a dev server left
  running across `git pull` (stale compiled modules). The pull instructions now say: stop the server, delete `.next`,
  `npm install`, start again. Before suspecting the code, read the Supabase logs of the Director's session.

## Commander Improvement Candidates
None yet.

### 2026-10-04 — No lessons this session (routine changes only)
README steps for VAPID keys and migration 030, Sprint 11 draft plan.
