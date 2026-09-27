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

## PDL-009 — Authentication dependencies and session model
**Date:** 2026-09-27
**Decision:** `@supabase/supabase-js` + `@supabase/ssr` (DL-001), `zod` 4 (E-2), dev: `vitest`,
`tsx` (bootstrap script), `@types/node` 22 (matches Node 22). No browser Supabase client: the
session cookie is HTTP-only and SameSite=Strict (E-4) and all auth runs in Server Actions,
the Data Access Layer (`session.ts`, `auth.getUser()` on every request) and `proxy.ts`
(optimistic redirects only). Lockout counts `security_events` (per username hash and per IP)
instead of a new table or an external rate-limit service.
**Known limitation (E-4):** blocking an account stops new sign-ins immediately; an already
issued access token stays valid until it expires (≤ 1 h), although `getCurrentAccount()`
refuses non-active accounts on every request.

## PDL-010 — Shadcn/UI deferred (deviation from DL-011)
**Date:** 2026-09-27
**Decision:** Sprint 01 screens (login, account administration) use plain semantic HTML components
styled with the project's CSS tokens instead of Shadcn/UI.
**Rationale:** Few, simple forms; adding the Shadcn tool chain and Radix dependencies for them would
add weight without benefit. Revisit at Sprint 06 (student Game Hub), where rich components (dialogs,
tabs, toasts) start to pay off; from then on DL-011 applies.

## PDL-011: No AI characters or AI phrasing in app text
**Date:** 2026-09-27
**Decision (Director):** recognisable AI characters and AI syntax are strictly forbidden in every
detail the AI creates in the app (simulation texts, chatbot answers, all UI text). Recorded as
CONSTITUTION P-13.
**Implementation:** rule list as data (`config/app-text-style.json`), shared by the CI/local check
(`scripts/check-app-text.mjs`, `npm run check:text`) and the runtime filter for generated text
(`src/lib/text-style.ts`). Existing UI text cleaned (dashes, ellipses, middle dots, arrow).
**Scope limit:** canonical source text keeps its original characters (P-4, AMB-13); code comments
and internal docs are not app text.
**Confirmed (Director, 2026-09-27):** "am, an" meant em dash and en dash.

## PDL-012: Full-width layout on every device; longer splash
**Date:** 2026-09-27
**Decision (Director):** all UI must fit every device type, operating system and operator; on
desktop and laptop all content spans the whole screen, margin to margin (CONSTITUTION P-14).
The splash stays 4 seconds longer before entry.
**Implementation:** `--content-max-width` removed; fluid margins with safe-area insets; viewport
`viewport-fit=cover`; login page becomes a two-column full-width card from 960 px.
`SPLASH_MIN_VISIBLE_MS` 1800 to 5800, fail-safe `SPLASH_MAX_VISIBLE_MS` 8000 to 12000; the
splash can still be skipped.
