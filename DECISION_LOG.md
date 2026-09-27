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
**Status:** confirmed by the Director 2026-09-27 (architecture and 12-sprint plan approved).

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
**Status:** confirmed by the Director 2026-09-27 (AMB-06).

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

## PDL-006 — Live multilingual UI (bs/de/en) without reload
**Date:** 2026-09-27
**Decision:** All interface text, system messages and generated content come from message
catalogues per locale (`src/i18n/messages/{bs,de,en}.json` now; DB-backed overrides later).
The chosen locale is stored in a cookie + client context; switching re-renders instantly,
no page reload. Canonical source text is excluded pending AMB-13.
**Rationale:** Director decision AMB-11. No i18n library added yet: a typed dictionary +
React context covers the need (M-12); revisit if pluralisation/ICU formatting is required.

## PDL-007 — Splash screen as a static first-paint module in `public/splash/`
**Date:** 2026-09-27
**Decision:** The splash is plain HTML/CSS/JS (no React, no dependencies) in
`public/splash/`, loaded by the root layout before the app shell, with a WebGL "flow"
background derived from the Director's `Untitled blend.jsx` recipe (IDSS palette stops,
grain, slow speed) and a CSS-gradient fallback. The app dismisses it through
`window.IDSSSplash.dismiss()`.
**Rationale:** Mandate §7A.8 requires the splash to be the first UI, before any app
content; a static module paints before hydration. The reference file is a 362 KB generated
multi-effect engine — only its FLOW recipe and principles (visibility/intersection pause,
reduced motion, DPR cap, grain) are re-implemented (mandate §7A.9: do not copy blindly).

## PDL-008 — Initial application dependencies
**Date:** 2026-09-27
**Decision:** `next` 16.3.6, `react`/`react-dom` 19.2.8 (Commander default stack, PDL-001);
`tailwindcss` 4 + `@tailwindcss/postcss` (Commander styling standard); `server-only` (Next.js
guard that keeps server modules out of client bundles — security, E-4); `@playwright/test`
(dev, end-to-end tests; mandate §22). Fonts via `next/font/google` (Sora, Inter), self-hosted at build.
**Not added yet:** Supabase, Zod, React Hook Form, shadcn/ui, Sentry, Vitest — each arrives with
the Sprint 01 step that needs it.
