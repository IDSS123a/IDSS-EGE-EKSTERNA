# Sprint 02 — Lessons Learned
Date: 2026-09-27 (open)

## Corrections Applied

## Gotchas Discovered
- An existing DB test forbids SECURITY DEFINER functions in `public` (lesson 004). Registry write functions are therefore SECURITY INVOKER and executable by `service_role` only; the capability of the explicit actor is re-checked by a SECURITY DEFINER helper in `private`.

## Commander Improvement Candidates
