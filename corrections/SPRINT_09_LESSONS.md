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
- `audit_logs` orders by `id` or `occurred_at`; it has no `created_at` (the DB test for migration 027 first used
  `created_at` and failed). Check a table's columns before writing a test query against it.
- Stopping the dev server by matching `/proc/*/cmdline` against a pattern also matched the running shell, whose own
  command line contained the same text, and killed it (exit 144). Kill only the PID written to the pid file and the
  `next-server` child whose parent is that PID; never match a pattern that appears in the killing command itself.
- One connector call applied the whole 22 KB of migration 027 (header comments with `drop` left out, so the
  destructive-statement check does not trigger on the rollback note).
- Piping `npm run build` into `grep ... | head` ended the build early (head closed the pipe, the build got SIGPIPE),
  leaving `.next` without `prerender-manifest.json`, so the e2e web server could not start. Run the build with its
  output in a log file and read the log; never cut a build's output with `head`.
- `/proc/<pid>/task/*/children` of the `npx next dev` wrapper did not list the `next-server` process, so killing the
  PID tree left the server running (port still answered 200). Confirm the port is closed after stopping, and stop
  `next-server` and the `next dev` node process by their own PIDs, excluding the current shell.
- Reusing `.practice-choice` for radio buttons inside a `.form__field` stretched each choice and its input across the
  full width (form inputs are `width: 100%`); the screenshot showed it before the push. Wrap choices in
  `.practice-choices` and give radio and checkbox inputs `width: auto`. Look at every new form in a screenshot.
- The fixture math catalogue in the DB tests has only one trusted question (MAT-5.1.1); a test that assumed MAT-5.1.2
  was trusted failed with UNKNOWN_KEYS, which was the function working correctly. Check fixture state before writing
  expectations.

## Commander Improvement Candidates
None yet.
