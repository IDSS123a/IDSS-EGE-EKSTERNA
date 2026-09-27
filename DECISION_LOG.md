# DECISION_LOG.md — IDSS EGE (project decisions)

Commander-level decisions (DL-001…DL-014) apply unless overridden here.

---

## PDL-001 — Stack: Commander default (Next.js + Supabase + Vercel), prototype not migrated
**Date:** 2026-09-27
**Decision:** Build the application fresh on Next.js (App Router) + Supabase + Vercel.
Keep `CODE-PROTOTYPE/` (Vite + Express) as reference only.
**Rationale:** The mandate says "FROM SCRATCH" and "use the Commander default stack unless
evidence justifies deviation". M-16/DL-009 protect *working* inherited codebases; the
prototype has no persistence (in-memory store), fail-open authentication, fabricated canon
content and five invented subjects (`docs/discovery/PROTOTYPE_AUDIT.md`). Its value is UX
patterns, which are ported feature by feature. RLS on Supabase gives the database-level
authorization the mandate requires.
**Alternative rejected:** DL-009 path (keep Vite + Express, add Supabase) — would keep an
auth layer that must be rewritten entirely anyway.
**Status:** proposed — the Director confirms at Sprint 01 start (M-16 asks for explicit confirmation).

## PDL-002 — Sprint-00 catalogue extractor in Python (developer tool only)
**Date:** 2026-09-27
**Decision:** `tools/canon-ingestion/extract_catalogues.py` (PyMuPDF) produced the Sprint-00
evidence and serves as the golden reference. It is not deployed. The runtime ingestion
pipeline is TypeScript inside the app and must reproduce its outputs.
**Rationale:** PyMuPDF gives span-level fonts (bold/italic = "istaknute riječi"),
bounding boxes and reliable reading order, which the evidence gate needed immediately.
DL-002 (no Python server) is respected because nothing Python runs in production.
**New dependency:** `pymupdf` (dev tool only, pinned in `tools/canon-ingestion/requirements.txt`).

## PDL-003 — Username + password on Supabase Auth
**Date:** 2026-09-27
**Decision:** The login form takes a username and password. Staff usernames are their
official e-mails; student usernames are school-issued. The server maps a username to the
Supabase Auth identity (non-routable internal address for students without e-mail);
passwords are hashed by Supabase Auth (bcrypt). Password reset for students is performed
by staff with capability `accounts.reset_password`, audited.
**Rationale:** Mandate §7A.5 requires username + password; E-4 requires provider-verified
tokens; students should not need a personal e-mail (data minimisation, §7A.6).
**Status:** proposed; depends on AMB-06.

## PDL-004 — Canon activation as a single SQL function
**Date:** 2026-09-27
**Decision:** Activation/supersession/rollback happen only in `activate_canon_version()`
(transaction: supersede old, activate new, bump `canon_generation`, mark dependencies stale,
write audit). A partial unique index enforces one active version per document.
**Rationale:** Data integrity (M-3 level 3); no application path can leave two active versions.

## PDL-005 — Parser profiles are versioned data
**Date:** 2026-09-27
**Decision:** Segmentation rules per document type (section/id/option/solution patterns,
page ranges) are stored as JSON parser profiles in the database, with a manual structuring
fallback in the review UI.
**Rationale:** Mandate §0 — compatible canon updates must not require code changes.
