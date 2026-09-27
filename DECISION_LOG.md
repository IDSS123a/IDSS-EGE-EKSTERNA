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

## PDL-013: Catalogue ingestion in TypeScript with pdf.js; parser profiles as data; no OCR
**Date:** 2026-09-27 (Sprint 03)
**Decision:** the application extracts catalogue records with `pdfjs-dist` (Mozilla pdf.js,
Apache-2.0, new dependency) instead of PyMuPDF (AGPL, used only as the Sprint 00 evidence tool).
Page ranges, header bands and declared totals per catalogue edition are data in
`config/parser-profiles.json`, bound to the exact file by SHA-256; an edition without a reviewed
profile is refused, never guessed (P-4). Every ingestion job stores the profile code and version.
**Evidence:** the TypeScript extractor reproduces the Sprint 00 reference for all 500 records
(Math 200, B/H/S 200 + 20, German 80 tasks / 200 scored items): identical IDs, structure, flags,
answer keys, options, scored items and text; the only difference is whitespace (pdf.js collapses
repeated spaces and spaces math operators). Guarded by `tests/unit/ingestion-regression.test.ts`.
**OCR:** not needed; all three catalogues have a complete text layer. A file without a text layer
fails ingestion with a clear report; OCR would be a new external dependency (Director decision, M-4).
**Alternatives rejected:** `mupdf` (WASM, AGPL-3.0: network-use obligations for a school web app);
running the Python tool on the server (second runtime on Vercel).

## PDL-014: Mock exams only from official catalogue tasks; practice variants need teacher approval
**Date:** 2026-09-27
**Decision (Director, AMB-17):** mock exams are assembled only from official catalogue tasks, as the
real matura is (ministry decision 2025/26, point III, SOURCE_INVENTORY C21). Practice variants are
allowed only per item with the subject teacher's approval and the visible label
"Vježba (nije službeno pitanje)"; until that workflow exists there are none.
**Design:** `docs/architecture/EXAM_SIMULATION.md`.

## PDL-015: Exam subjects and rules as canonical facts with verified page quotes
**Date:** 2026-09-27 (Sprint 04)
**Decision:** the three exam subjects and the exam rules (duration, task count, total points, scoring,
test composition, allowed and forbidden aids, Math level blueprint) are data in
`config/canonical-facts.json`, one entry per catalogue edition bound by SHA-256. Every value carries
verbatim quotes with their PDF page; `tests/unit/knowledge.test.ts` finds each quote on its page in
the repository copy, and the server repeats the check on the stored file before `load_canonical_facts`
(migration 008) writes anything. Subject teachers confirm or dispute each rule (AMB-09, AMB-10).
**Why the catalogues and not the rulebook:** the rulebook PDF (C2) has an unusable text layer (broken
font encoding), so its Art. 5 cannot be quoted verifiably without OCR (PDL-013: no OCR). Each subject
row cites Pravilnik Art. 5 as legal basis and quotes its own catalogue (level 3, text layer verified).
When a PDF of the rulebook with a readable text layer exists, an Art. 5 quote is added as evidence.
**Also decided (implementation):** question options and scored items of a trusted question version are
stored as JSON in `question_versions` (not yet as `question_options` / `scored_items` rows, DATA_MODEL §4)
until practice needs row-level access (Sprint 06); keys are rows (`answer_keys`) so revisions can
reference them (CF-03). pdf.js renders source regions in the browser from the legacy build (the modern
build needs `Map.prototype.getOrInsertComputed`, missing in current and older browsers, P-14); CSP gains
`worker-src 'self'` for its worker.

## PDL-016: Bulk acceptance of the catalogue records and rules by the Director
**Date:** 2026-09-27 (Sprint 04)
**Decision (Director):** "Prihvati sva pitanja i pravila", confirmed after the consequences were stated
(acceptance is final; no per-item comparison with the source page; 184 Math tasks flagged for 2-D notation;
AMB-09 and AMB-10 confirmed without the subject teachers). Option chosen: accept with a visible tag.
**Executed by ACA** through the migration 008 functions in one transaction, actor = Director's account:
492 records accepted (2 more the Director had accepted individually before), every decision and rule
confirmation carries the note "Skupno prihvatanje po nalogu direktora (27.09.2026), bez pojedinačnog
pregleda; izvršio ACA." 6 German records whose task type the extractor did not recognise stay pending
(a task type is never invented, P-4). 20 rules confirmed (they had already been confirmed individually by the
Director minutes earlier; the bulk run added a second, tagged confirmation, see SPRINT_04_LESSONS).
**Consequence:** 494 trusted question versions and 576 printed keys exist. Subject teachers can still correct
keys by revision; a record cannot be un-accepted (append-only by design). Later work that shows questions to
students should let teachers flag bulk-accepted questions for individual re-review (proposal for Sprint 06).

## PDL-017: Retrieval foundation on PostgreSQL full-text search; Gemini embeddings later
**Date:** 2026-09-27 (Sprint 05)
**Decision (Director):** build the retrieval layer now without an external AI service or key; semantic search with
Gemini embeddings (DL-005) is added when the Director provides a key.
**Design:** chunks of trusted question versions and confirmed rules only (never untrusted records, never answer keys),
`retrieve_canon()` filters active versions and the actor's subjects before ranking, audits every call with the query's
SHA-256 (never the text), bounded k. Query text is reduced to letter/digit tokens (no query syntax can be injected);
diacritics and case are folded (č ć đ š ž, ä ö ü ß); words of 5+ letters match by prefix (inflection); B/H/S and German
function words are dropped; ranking = number of matched content words, then `ts_rank_cd`. Callers use the
`CanonRetriever` interface (A-5), so the embedding implementation replaces the ranking without touching them.
Generation (later) receives only cited, delimited source blocks after a fixed instruction; no evidence above the
relevance floor gives the fixed refusal text.
**Evidence:** live checks on the 514 real chunks (rolled back): "Koliko traje ispit iz matematike?" ranks
`exam.duration_minutes` first, "koliko bodova nosi povezivanje" ranks `exam.scoring` first, "Perfekt Hilfsverb" finds
German grammar tasks. Known limit: meaning without shared words (synonyms) needs the embeddings.
**Alternatives rejected for now:** pgvector with Supabase's built-in small embedding model (a second model family
beside Gemini, weaker for B/H/S); trigram similarity only (no ranking by content words).

## PDL-018: The teacher grades mock exams; answers after grading; notifications; game follows the grade
**Date:** 2026-09-27 (Director, after the first live search)
**Decisions:**
1. **Grading:** a submitted mock exam goes to the subject teacher's grading queue. The system pre-scores closed items
   (multiple choice, matching, true/false) with the catalogue key (and reviewed key revisions, CF-03) as a proposal;
   the teacher grades open items (Math tasks 5 to 10 with working, B/H/S completion and short answers) by the official
   scoring rules (0 / 0,5 / 1 point, C12 to C14), may change any proposal, and confirms the final result. The student sees
   the result only after the teacher's confirmation.
2. **Answers:** the student never sees correct answers in advance. Mock exam: solutions and explanations after the
   teacher's grading. Practice: the solution after the student has submitted an answer, never before.
   (Already true today: answer keys are readable only by staff (RLS) and are excluded from the search index.)
3. **Notifications (in the app):** the teacher gets one notification per submitted mock exam waiting for grading and
   one daily summary (who practised, who is inactive, weak areas). No notification per practice answer.
4. **Game follows the grade (P-7):** effort and regularity (practice, streaks, missions) earn XP and badges; the
   teacher's confirmed grade is the main source of rewards: when the teacher confirms a mock exam, the student receives
   the XP and special recognitions tied to that result. XP never changes a score.
**Plan impact:** Sprint 07 (exam engine) includes the grading queue, pre-scoring and grade confirmation; Sprint 08
(gamification) awards on confirmed grades; notifications arrive with Sprint 07 (grading) and Sprint 09 (daily summary).

## PDL-019: Splash palette: yellow, blue and sky prevail; red only in traces
**Date:** 2026-09-27 (Director)
**Decision:** in the splash field #E8262C (red) appears only in traces; #FFCB29 (yellow), #035EA1 (blue) and #08ABE6
(sky) prevail. Amends PDL-007 (same four IDSS stops, new proportions).
**Implementation:** `public/splash/splash.js`: blue and yellow alternate in the main field; sky and red are layers from
their own noise fields, drawn above a threshold; thresholds are recipe data (`skyThreshold`, `redThreshold`, `yellowFrom`,
`blend`). Measured on rendered frames (1440 x 900, two moments): yellow 28 to 30 %, sky 26 to 27 %, blue 23 %, red 1.5 %,
rest the card and edges. CSS fallback without WebGL: a small red spot, larger yellow fields; card rule and progress bar
use red for 6 % of their length.

## PDL-020: The Director sets the splash colour shares in percent
**Date:** 2026-09-27 (Director)
**Decision:** the share of each IDSS colour in the splash (#E8262C, #FFCB29, #035EA1, #08ABE6) is a setting the
Superadmin enters in percent (Postavke), adding up to 100. Default: red 2, yellow 36, blue 29, sky 33.
**Implementation:** migration 012 (`system_settings`, capability `settings.manage`, `set_splash_palette` validated and
audited with before/after); `/app/postavke` form with live total and ratio bar; public route `/splash/palette` (outside
the auth proxy, cached 60 s, default on any error) returns the shares and the shader thresholds; `splash.js` starts with
the default thresholds and applies the Director's when they arrive. Percentages become thresholds through curves measured
on rendered frames (`config/splash-calibration.json`, `src/features/splash/palette.ts`); verified by rendering four
palettes: every colour within about 1.5 percentage points of its target. The CSS fallback (no WebGL) keeps the default
proportions. Re-measure the curves whenever the shader changes.

## PDL-021: Question text for students comes from reviewed text revisions
**Date:** 2026-09-27 (ACA, Sprint 06 item 1, AMB-19)
**Decision:** the trusted question version keeps the text exactly as extracted from the printed catalogue. A reviewer
(canon.review of the subject, or canon.publish) records a text revision; the newest revision is the text students see.
A revision changes texts only (question text, stem, option texts, scored item texts); option labels, sub-part labels and
item numbers must stay as in the version, so a revision can never change what an answer key refers to.
**AMB-19:** five Math questions (MAT-5.3.5, 5.4.20, 5.9.13, 5.10.6, 5.10.20) carry page footnotes (source references,
links) and, in two cases, the footnote marker after the task sentence. Proposals are data in
`config/text-revision-proposals.json`; a unit test proves every removed footnote is printed on the stated page and that
the task line stays. The review screen fills a proposal into the form; nothing is stored until a reviewer confirms it.
DEU-4.2.5 is not affected: `www.musikwettbewerb.de` is printed in the reading text at text size (12 pt), not as a
footnote (8 pt), so it stays.
**Implementation:** migration 013, `src/features/review/domain/text-revision.ts`, `reviseQuestionTextAction`,
`QuestionTextSection` in the record screen. The retrieval index keeps the catalogue text (staff search); practice screens
(Sprint 06 item 4) show the newest revision.
**Addendum (27.09.2026, migration 014):** line breaks are stored as \n and a revision equal to the text students
currently see is refused (UNCHANGED). The Director confirmed the five AMB-19 revisions; four earlier no-op revisions
(MAT-5.3.7 to 5.3.10) stay in the append-only history and do not change any text.

## PDL-022: The splash is the reference FLOW algorithm; shares become colour weights
**Date:** 2026-09-27 (Director: "Veoma sam bio zadovoljan s ovim rješenjem samo što ja hoću da diktiram učešća boja",
with the reference file `Untitled_blend.jsx`)
**Decision:** the splash field is an exact port of the FLOW algorithm of the reference (four colour points on their
reference paths, soft warp and swirl, weighted inverse-distance blend 1/d^4 in sRGB, the reference player's clock of
speed / 100 * 1.2 per second; stops #E8262C #08ABE6 #035EA1 #FFCB29, scale 56, distortion 18, swirl 13, grain 9). In
the reference tool the colour divisions are weights; the Director's shares (Postavke, PDL-020) become these weights.
**Implementation:** `src/features/splash/flow.ts` holds the formula; `flowWeightsFor()` measures the field over the
first six seconds (96 x 64 samples, 9 moments, nearest colour) and adjusts the weights until every colour covers its
share within 0.2 points (unit test: within half a point); a colour at 0 % gets weight 0. `/splash/palette` returns
the weights (memoised per palette); `public/splash/splash.js` runs the same formula as a WebGL shader and ships the
weights of the default shares (checked by a unit test). Supersedes the threshold layers and calibration curves of
PDL-019 and PDL-020 (`config/splash-calibration.json` removed).

