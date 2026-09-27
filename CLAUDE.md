# CLAUDE.md — IDSS EGE

Project: IDSS EGE — External Matura Preparation Platform (Grade 9), IDSS Sarajevo
Repository: https://github.com/IDSS123a/IDSS-EGE-EKSTERNA
Governance: Commander v1.6.1 (https://github.com/IDSS123a/commander) · Mode: FULL

## Every session start
1. Read this file, `CONSTITUTION.md` and the current sprint document in `sprints/`.
2. Load Commander documents by tier (M-21): Tier 1 always (CONSTITUTION M-1…M-5);
   Tier 2 for implementation (ENGINEERING_RULES, ARCHITECTURE_PATTERNS, C-1…C-5).
3. Communicate with the Director in Bosnian; code, docs and commits in English.

## Where things are
- Product mandate: `docs/mandate/INSTRUCTION-WEB-APP-IDSS-EGE.html`
- Evidence: `docs/discovery/` (source inventory, prototype audit, ambiguities)
- Architecture: `docs/architecture/` · Plan: `docs/IMPLEMENTATION_PLAN.md`
- Decisions: `DECISION_LOG.md` · Changes: `CHANGELOG.md`
- Canon ingestion evidence: `tools/canon-ingestion/` (report in `output/INGESTION_REPORT.md`)
- Official sources: repo root PDFs (catalogues) and `OSTALI-DOKUMENTI/`
- Prototype (reference only, level 6): `CODE-PROTOTYPE/`

## Non-negotiables (details in CONSTITUTION.md)
- Three subjects only (B/H/S, Matematika, first foreign language = Njemački for IDSS).
- Canon is data with provenance; never hard-code exam rules, questions or keys.
- Never invent questions, answers, scoring, timing, thresholds. Unknown → `docs/discovery/AMBIGUITIES.md`.
- Never import files containing personal data (`SOURCE_INVENTORY.md` §5).
- Authorization server-side + RLS; UI hiding is not authorization.
- Destructive actions, history rewrites, production deploys: ask the Director first (M-4, M-23).

## Lesson capture (M-18)
The moment a correction or gotcha occurs, append it to `corrections/SPRINT_XX_LESSONS.md`
in the same turn, and log sprint activity in `corrections/ACTIVITY_LOG.md`.

## Sprint close ("sprint je gotov")
Run Commander DONE_CHECKLIST, fix FAILs, fill the Compliance score, write the handoff
note in the sprint document, commit and push, propose the next sprint.
