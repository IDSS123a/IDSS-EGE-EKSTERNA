# Sprint 10 — Lessons Learned
Date: 2026-10-04 (closed)

## Corrections Applied
- (Caught by the Director) The Sistem tab failed live with 403: `director_system` read
  `supabase_migrations.schema_migrations`, and service_role has no usage on that schema. Fix: migration 034 (security
  definer `private.recent_migrations`); the test stub mirrors the schema without grants; DB section 27 calls the
  function as service_role and fails without 034.
- (Director) The browser's own confirm box looked foreign to the app. All ten `window.confirm` calls now use the IDSS
  dialog (`ConfirmProvider`, `useConfirmSubmit`), verified on desktop and phone (Cancel, Escape, Potvrdi with the
  pressed button's value preserved).
- (Caught by ACA) `set_setting` validation let an incomplete IDSS points object through because `<>` on a missing key
  is NULL; the DB test caught it. Validations use `is distinct from`.

## Gotchas Discovered
- A live probe run as the owner proves nothing about the app: the app calls functions as service_role. Probe with
  `set local role service_role` inside a rolled-back transaction.
- A dev server left running across `git pull` serves stale modules and shows the error page; the Supabase logs of the
  Director's session (all 200) pointed away from the code. README now says: stop the server, delete `.next`,
  `npm install`, start again.
- The global CSS reset removes the native `<dialog>` auto-centring; the dialog sets `position: fixed; inset: 0;
  margin: auto` itself.
- `react-hooks/error-boundaries` refuses JSX built inside try/catch in a server page; load data in a helper inside
  try/catch and render after it.
- After removing a temporary preview route, `.next/dev/types` still references it and `tsc` fails; delete that
  generated folder before the typecheck.

## Commander Improvement Candidates
- Live verification of a database function used by the app must run under the app's role (service_role or
  authenticated with claims), never as the owner.
- Test stubs of a hosted platform mirror the platform's privileges on its own schemas, not only their existence.
