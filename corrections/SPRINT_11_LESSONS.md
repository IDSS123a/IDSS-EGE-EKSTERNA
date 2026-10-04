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
None yet.

## Commander Improvement Candidates
None yet.

### 2026-10-04 — No lessons this session (routine changes only)
Migration 030 verified and recorded; PDL-041 L2 refined; README deployment steps.
