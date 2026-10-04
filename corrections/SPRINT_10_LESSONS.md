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

- 2026-10-04 (caught by the Director): the Sistem tab failed live with 403. `director_system` read
  `supabase_migrations.schema_migrations`, and service_role has no usage on that schema. The live probe ran as the
  owner and the local stub had no such schema, so neither saw it. Fix: migration 034 (security definer
  `private.recent_migrations`), the stub mirrors the schema without grants, and the DB test calls the function as
  service_role. Rule: a live probe of an app function runs under `set local role service_role`, the way the app calls it.
- 2026-10-04 (Director): the browser's own confirm box looked foreign to the app. All ten `window.confirm` calls now use
  the IDSS dialog (`ConfirmProvider`, `useConfirmSubmit`); the global CSS reset removes the dialog's auto-centring,
  so the dialog sets `position: fixed; inset: 0; margin: auto` itself.

## Commander Improvement Candidates
None yet.

### 2026-10-04 — No lessons this session (routine changes only)
README steps for VAPID keys and migration 030, Sprint 11 draft plan.
