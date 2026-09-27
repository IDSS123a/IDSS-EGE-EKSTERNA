# CONSTITUTION.md — IDSS EGE (project)

Commander version: 1.6.1 · Mode: FULL (sprints) · Created: 2026-09-27
Precedence: Commander CONSTITUTION > ENGINEERING_RULES > ARCHITECTURE_PATTERNS >
ACA_COMMUNICATION_PROTOCOL > **this document** > current sprint document.
Full product mandate: `docs/mandate/INSTRUCTION-WEB-APP-IDSS-EGE.html`.

## P-1. Identity
IDSS EGE is a canonical-source-driven preparation platform for the Sarajevo Canton
external matura (Grade 9) at P.U. Internationale Deutsche Schule Sarajevo (IDSS).
Students get a game-first learning experience; staff get support and monitoring
tools; leadership gets aggregate oversight. It is not a generic LMS.

## P-2. Three-subject rule (🔴)
Exam subjects are exactly those of the active rulebook: B/H/S jezik i književnost,
Matematika, first foreign language (for IDSS: Njemački jezik). Evidence:
Pravilnik Art. 5 (see `docs/discovery/SOURCE_INVENTORY.md`). No fourth subject.

## P-3. Canon is data, never code (🔴)
Exam rules, catalogue questions, answer keys, official forms and legal wording are
stored as rows derived from an **active canonical document version** with provenance
(document, version, page). A new ministry publication is handled by Superadmin upload
→ ingestion → review → activation; the previous version becomes superseded and is
never deleted. No developer deployment for a compatible canon update.

## P-4. No invented academic content (🔴)
No invented questions, answers, scoring, competencies, timing or thresholds. Missing
or ambiguous source → record in `docs/discovery/AMBIGUITIES.md`, route to review.
AI-derived items are labelled derived, linked to their sources, and never "official".

## P-5. Two validation gates (🔴)
A catalogue question is trusted only after the automatic structural gate **and** the
human semantic/source gate. Extraction success is not understanding.

## P-6. Security and privacy (🔴)
Username + password for every user; provider-verified sessions; RBAC/capabilities
server-side and in RLS; least privilege; support notes separated; no inference of
psychological/medical/intelligence/personality traits; longitudinal student history
retained across school years; no claim of absolute security.

## P-7. Game ≠ grade (🟡)
XP, levels, badges and streaks motivate; they never change or represent official
scoring. Mastery and readiness are labelled internal educational indicators.

## P-8. First paint (🟡)
The splash screen with the official IDSS logo and ≥ 10 rotating motivational
messages appears before any app content and respects `prefers-reduced-motion`.

## P-9. Language
Communicate with the Director in Bosnian. Code, technical docs and commits in English.
Student UI primarily Bosnian through an i18n layer; academic material keeps its source language.

## P-10. Stack
Next.js + Supabase + Vercel (Commander default, see `DECISION_LOG.md` PDL-001).

## P-11. Named business rules (from the mandate; do not change without the Director)
- Superadministrator: Davor Mulalić, direktor@idss.ba.
- Administrators: Haris Hamzić (Matematika), Nikolina Todorović (Njemački jezik),
  Nizama Memija (B/H/S), Adnana Agić (pedagog), Medina Karaga (psiholog).
- IDSS palette: #035EA1, #08ABE6, #FFCB29, #E8262C, #000000 — used through semantic tokens.
- Official logo: https://idss.edu.ba/wp-content/uploads/2024/03/logo_white.png (never recreated).

## P-13. No AI characters or AI phrasing in app text (🔴, Director 2026-09-27)
Every text the app shows or the AI creates (UI, simulation texts, feedback, explanations,
chatbot answers) must not contain recognisable AI characters or AI phrasing: em dash, en dash,
the ellipsis character, curly quotes, middle dot, bullets, arrows, emoji, and phrases such as
"Odlično pitanje", "Nadam se da ovo pomaže", "Kao AI". The list is data in
`config/app-text-style.json`; `npm run check:text` (also in CI) enforces it on app text, and
generated text goes through `src/lib/text-style.ts` before it is shown (characters replaced,
text with a forbidden phrase regenerated, never displayed).
Exception: canonical source text (official questions, answers, catalogue excerpts) stays
verbatim (P-4, AMB-13).

## P-14. Every device, full width (🔴, Director 2026-09-27)
All UI works on every device class the app can run on (phones, tablets, laptops, desktops,
large and touch screens), every browser and operating system (Android, iOS/iPadOS, Windows,
macOS, Linux, ChromeOS) and every network operator. On desktops and laptops all content spans
the full screen width, margin to margin; no fixed content column. Means: fluid layout without
max-width columns, margins as `--space-page-x` with device safe areas, touch targets at least
44 px, user zoom allowed, no hover-only functions, `100dvh`. Enforced by `tests/e2e/layout.spec.ts`
(no horizontal scroll from 320 px to 2560 px; desktop content spans the width).

## P-12. Known limitation (E-4)
Blocking a user prevents new logins immediately; an already-issued access token stays
valid until expiry (≤ 1 h). Shown in the admin UI when blocking.
