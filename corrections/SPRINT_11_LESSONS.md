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

- The Director's restatement of the product logic two days before launch showed that the mock exam is still
  student-initiated, while the mandate sees the teacher as owner of the whole process. A short "who starts what"
  table per role, checked against the mandate at each sprint start, would have caught it earlier.

- A DB test that calls a function and checks its effect in the same SQL statement sees the old snapshot; split the
  call and the check into two statements.
- Applying a large migration through the connector means retyping it; verify afterwards by comparing md5(prosrc) of
  every function with the body in the file.

## Commander Improvement Candidates
- Every "open risk" in a sprint handoff gets a tracked follow-up item in the next sprint plan, checked at sprint start.

### 2026-10-04 — No lessons this session (routine changes only)
Migration 030 verified and recorded; PDL-041 L2 refined; README deployment steps.

### 2026-10-04 — Teacher-sent sets and the approval gate
- A set the teacher sent is visible to the student in the overview as soon as it exists (one open exam per subject),
  which would leak the teacher's message before approval (T4). The student screens now show only "the teacher is
  preparing a test" until approval; check every new exam field against the approval gate.
- A part of a test mixed into the profile trend compared points of different maxima; trends compare only exams of the
  same kind and positions.


### 2026-10-04 — No lessons this session (routine changes only)
Migration 036 verified live and recorded; rolled-back end-to-end check of a teacher-sent part of a test.

### 2026-10-04 — No lessons this session (routine changes only)
Presentation script written from the user guide; facts checked against the live database (German blueprint not yet confirmed).

### 2026-10-04 — No lessons this session (routine changes only)
F-04 backup path settled: free plan, own pg_dump 17 copy on the day of the cleanup.

### 2026-10-04 — Windows command instructions for the Director
- A long command pasted from chat into PowerShell or cmd got a line break inside the quoted connection string
  (database "postgres<newline>" does not exist), and `&` failed in cmd. Give Windows commands as short variable
  assignments (`$db = "..."`, then `& "$pg\tool.exe" -d $db`), name the shell explicitly, and say "one line".

### 2026-10-04 — Pushing to a branch whose PR was already merged
- After #58 was merged, four doc commits (SKRIPTA.md, 036 record, F-04) were pushed to the session branch and reported
  to the Director as "in PR #58"; they never reached main. Before reporting where a change is, check the PR state
  (`gh api repos/.../pulls/N --jq .merged`) and open a new PR when the previous one is merged.
