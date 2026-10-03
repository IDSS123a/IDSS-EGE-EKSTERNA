# SPRINT 10 — Director Command Center

Status: **in progress** (K1 to K6 accepted 2026-10-04, PDL-040, K2 minimum group 3) · Started 2026-10-04 (Director: "odobreno")
Prerequisites met: Sprint 09 closed. Design proposal `docs/architecture/DIRECTOR_COMMAND_CENTER.md` waits for the
Director's decisions K1 to K6: accepted ("prihvatam. K2 3").
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, `CONSTITUTION.md` (P-4, P-7,
P-13, P-14, P-15), mandate §13, ROLES_AND_PERMISSIONS §2 and §3, PDL-036.

## IN (after K1 to K6)
1. Migration 033: read-only institution functions (overview, subjects, teachers, content, system, audit log), DB tests.
2. `/app/direktor` with the tabs Pregled, Predmeti, Nastavnici, Sadržaj, Sistem, Dnevnik, Postavke; IDSS print and CSV.
3. Settings moved into the database per K5, with audit and history.
4. User guide: superadministrator chapter and Davor Mulalić's personal page.

## OUT
Production deploy and the clean start (Sprint 11, PDL-038); classes (wait for the generation and class labels).

## Acceptance criteria
- Only `analytics.view_institution` opens the screens; the audit log only with `audit.view` (DB tests).
- No view returns support note, teacher note or gift message content; exports are audited.
- Aggregates only, except the links into Praćenje učenika.

## Progress
- [x] 0. Design proposal with decisions K1 to K6.
- [x] 1. Migration 033 live (Director functions, settings with history, K2 suppression); DB tests section 27; advisor only the known Auth WARN.
- [x] 2. `/app/direktor`: Pregled, Predmeti, Nastavnici, Sadržaj, Sistem, Dnevnik (filters, paging); periods 7/30/90/godina; "premalo učenika"; IDSS print on every tab; CSV for Nastavnici and Dnevnik (`/app/direktor/izvoz`, audited); link to the daily summary (K6); home link "Direktorski pregled".
- [x] 3. Settings K5 in Postavke: daily mission goal, minimum group, IDSS points and badges, each with history; Game Hub and student profile read them (code defaults as fallback).
- [x] 4. User guide: superadministrator chapter and Davor Mulalić's page; SCREENSHOTS rows (fixture).
- Checks: typecheck, lint, check:text, vitest 171, build, e2e 72 passed.
