# Sprint 02 — Lessons Learned
Date: 2026-09-27 (open)

## Corrections Applied
1. Grid form inputs overflowed their columns at 1920 px (intrinsic input width) → `width: 100%; min-width: 0` on grid fields; found on a fixture screenshot, not by tests → P-14 visual check stays mandatory.
2. Bosnian dates rendered as "2026 M09 27" in Chromium (thin ICU data for `bs`) → dates composed from numeric parts with a fixed time zone; unit-tested.

## Gotchas Discovered
- An existing DB test forbids SECURITY DEFINER functions in `public` (lesson 004). Registry write functions are therefore SECURITY INVOKER and executable by `service_role` only; the capability of the explicit actor is re-checked by a SECURITY DEFINER helper in `private`.

- Next.js Server Actions accept 1 MB bodies by default and Vercel functions about 4.5 MB: large files must go browser → storage via a single-use signed upload URL, with verification on the server afterwards.
- Deleting a temporary page leaves stale `.next/types` references; `tsc` fails until the next build.

## Commander Improvement Candidates
- ARCHITECTURE_PATTERNS: "verified direct upload": signed single-use upload to a staging path, server re-reads and verifies (magic bytes, size, hash), content-addressed final path, staging always removed, CSP connect-src limited to the signed-upload path prefix.
