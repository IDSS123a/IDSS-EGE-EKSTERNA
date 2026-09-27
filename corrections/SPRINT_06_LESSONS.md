# Sprint 06 — Lessons Learned
Date: 2026-09-27 (open)

## Corrections Applied
1. Account administration forbade changing one's own account (no self-lockout) and there was no self-service password
   change, so administrators could not change their own password; found by the Director → `/app/nalog` for every account.
   Every role's own-account basics (password, name) are checked against the role list when a sprint adds accounts.

## Gotchas Discovered
- A WebGL canvas cannot be read back after drawing (no `preserveDrawingBuffer`): colour measurements of the splash
  returned zeros until they were taken from screenshots.
- React writes `style={{...}}` into server-rendered HTML as a style attribute, which the nonce CSP blocks; dynamic
  sizes are set through the CSSOM after render, colours through classes.
- AMB-19 listed DEU-4.2.5 among the footnote cases because its text contains a web address; the source page shows
  `www.musikwettbewerb.de` at text size inside the reading text, while footnotes are 8 pt at the page bottom. A text
  is classified as a footnote only after its font size and position were read from the page.
- `pkill -f next` / `kill $(pgrep -f next-server)` in the same shell matched the shell's own command line and killed
  it (exit 144); dev servers are stopped by the PID written when they start.

## Commander Improvement Candidates
None yet.
