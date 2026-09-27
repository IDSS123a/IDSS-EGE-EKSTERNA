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

## Commander Improvement Candidates
None yet.
