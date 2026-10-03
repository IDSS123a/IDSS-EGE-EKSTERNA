# Sprint 08 — Lessons Learned
Date: 2026-10-03 (closed)

## Corrections Applied
1. A Python `rstrip("});")` strips any of those characters, not the suffix, and cut a test file's closing braces
   (Vitest: "no tests"; caught by the ACA at once) → file endings are edited by exact string replacement.
2. Writing the user guide against real labels found two stale texts shown to users (public home "Trenutno se gradi
   Sprint 02"; staff home workspace "se gradi") → replaced; app texts describe what the user can do, never the
   project's progress, and the guide is updated in the same change as its screen (PDL-031).
3. A new AMBIGUITIES row had 4 cells in a 6-column table → rewritten with all columns; count header cells before
   appending to a Markdown table.

## Gotchas Discovered
- Gamification values and readiness scales are not in the mandate; they are Director decisions recorded before
  implementation (PDL-029, PDL-032), never developer defaults.
- Supabase leaked-password protection is Pro-only; the dashboard switch fails on Free. Rebuilt in the app with the
  Pwned Passwords range API (k-anonymity, PDL-030); the advisor WARN is recorded as mitigated. The build sandbox cannot
  reach the API, so the check is tested with a fake service and fails open with a log entry.
- IDSS points derived read-only from the facts they reward cannot drift and cannot touch a score; a `stable` function
  is proven unable to write (DB test). A ledger is only needed once points must survive a change of the facts.
- `next dev` reports inline-style CSP errors on every page (33 on the login page too); console checks of new screens
  compare against the login page or run on the production build.
- Staff analytics offer filters the user sets (N days without practice, a drop against the student's own previous
  exam), never a system "risk" label (P-4, mandate §11).

## Commander Improvement Candidates
- ENGINEERING_RULES: "a security control the platform gates behind a paid plan is rebuilt in the application when it is
  cheap and privacy-safe, and the advisor finding is recorded as mitigated" (PDL-030).
- DONE_CHECKLIST Documentation: "the user guide chapter of every changed screen is updated in the same change" (PDL-031).
