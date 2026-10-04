# Sprint 11 — Lessons Learned
Date: 2026-10-04 (open)

## Corrections Applied
- (Caught by the Director) The Sistem tab still showed the error page after 034. The database answered 200; the page
  crashed in `pushConfigured()`, because `webpush.setVapidDetails` throws on a malformed VAPID value and the Director
  has VAPID values set (every test ran without them). Fix: `pushStatus()` reports off, on or invalid with the field
  name and never throws; the Sistem tab names the field to correct; unit tests cover missing, valid, subject without
  "mailto:", quoted key and swapped keys. Rule: code that reads configuration is tested with the values present and
  malformed, not only absent.

## Gotchas Discovered
- A placeholder in an instruction for the Director is copied literally: "(Public Key)" left the parentheses in
  `.env.local` and made both VAPID keys invalid. Instructions show a shortened real-looking value and say explicitly
  "no brackets, quotes or spaces".

- axe measures colours mid-transition right after a click (the language switcher), which reports a false contrast
  violation now and then; the accessibility spec waits for `document.getAnimations()` to finish first.
- A horizontally scrolling table wrapper is unreachable by keyboard (`scrollable-region-focusable`); every
  `.table-scroll` now has `tabIndex={0}`, `role="region"` and a label.
- Opacity on a muted text lowers contrast below 4.5:1 (unearned badges, 4.35:1); muted state uses the muted ink
  colour and a dashed border instead.

- A large adversarial DO block through the Supabase connector timed out after 60 s without leaving a session open;
  split probes into small statements with `set local statement_timeout`.

- An open risk recorded in a sprint (PDL-016: re-review of 492 bulk-accepted questions "proposal for Sprint 06") was
  never scheduled and surfaced only at the release gate. Open risks in a handoff note need an owner and a sprint, or
  they reach launch silently.

## Commander Improvement Candidates
- Every "open risk" in a sprint handoff gets a tracked follow-up item in the next sprint plan, checked at sprint start.

### 2026-10-04 — No lessons this session (routine changes only)
Migration 030 verified and recorded; PDL-041 L2 refined; README deployment steps.
