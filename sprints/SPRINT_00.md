# SPRINT 00 — Bootstrap & Discovery

Dates: 2026-09-27 · Mode: FULL · Commander 1.6.1

## Scope
IN: Commander governance load, full repository audit, evidence map, prototype audit,
catalogue ingestion evidence with report, architecture + data model + roles, ambiguity
register, phased plan, Sprint 01 definition.
OUT: application code, database, deployment (mandate §27: no coding before evidence).

## Completed
- [x] Commander governance (7 documents) read from `main`
- [x] Repository inventory: 3 catalogues, 44 files in `OSTALI-DOKUMENTI`, prototype (49 files)
- [x] Text extraction for all PDF/DOCX/XLSX; OCR (Tesseract bos+hrv) for image-only ministry documents
- [x] `docs/discovery/SOURCE_INVENTORY.md` — authority levels, verified facts, conflicts
- [x] `docs/discovery/PROTOTYPE_AUDIT.md` — reuse/adapt/replace, security findings
- [x] `docs/discovery/AMBIGUITIES.md` — 12 open items
- [x] `tools/canon-ingestion/` — extractor + outputs + `INGESTION_REPORT.md`
  (Math 200 tasks, B/H/S 200 questions + 20 supplementary, German 200 scored items in 80 tasks; all with printed answer keys; 0 structural failures; 0 trusted — semantic gate pending)
- [x] `docs/architecture/{ARCHITECTURE,DATA_MODEL,ROLES_AND_PERMISSIONS}.md`
- [x] `CONSTITUTION.md`, `DECISION_LOG.md`, `CLAUDE.md`, `CHANGELOG.md`, `.commander-version`
- [x] `docs/IMPLEMENTATION_PLAN.md`, `sprints/SPRINT_01.md`

## Not completed
- Commander automation hooks/skills/CI guard not installed (AMB-12)
- Official logo byte-verification (AMB-07); splash reference file missing (AMB-08)

HANDOFF NOTE — Sprint 00
Completed: discovery, evidence map, ingestion evidence, architecture, plan.
Not completed: Commander automation install; logo verification.
Open risks: public repository holds minors' personal data (AMB-01); catalogue currency unverified (AMB-02).
Technical debt: none in product code (no product code yet). Extractor is a dev tool (PDL-002).
Next sprint: Sprint 01 — Foundation (after Director confirms PDL-001 and answers AMB-01/03/06).

COMMANDER COMPLIANCE — Sprint 00
──────────────────────────────────
Rules followed without reminder:        M-1, M-2, M-4, M-9, M-10, M-14, M-15, M-21, M-23, C-6, E-10 — 11/12
Rules violated, caught by ACA:          1 (Step 3.3 automation install attempted from tag, blocked by session policy — not bypassed)
Rules violated, caught by Director:     0
Rules that slowed work or felt wrong:   initial_instructions Step 2 (questions) — answered by the mandate itself, so not asked (C-6)
New rules suggested by this sprint:     see corrections/SPRINT_00_LESSONS.md
