# SPRINT 10 — Director Command Center

Status: **closed 2026-10-04** (Director: "sprint je gotov"; K1 to K6 accepted, PDL-040, K2 minimum group 3) · Started 2026-10-04 (Director: "odobreno")
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
- [x] 5. IDSS confirmation dialog replaces every browser confirm box (Director's request).
- [x] 6. Migration 034 live: Sistem tab as service_role (reported by the Director); DB test as service_role.

## DONE checklist (Commander v1.6.2, 2026-10-04)
| Area | Result | Notes |
|---|---|---|
| Code quality | PASS | typecheck clean; no `any`, `@ts-ignore`, TODO or `console.log` in the 32 changed source files |
| Browser console | PASS | every Director tab and the confirmation dialog rendered on desktop and phone with errors captured; no uncaught errors, no horizontal overflow (dev CSP inline-style notices are dev tooling only) |
| Architecture | PASS | page authorises, repository calls database functions, permissions in `lib/permissions.ts`; settings read through one module with code defaults |
| Security | PASS after fix | every director function re-checks `analytics.view_institution` (log: `audit.view`), service_role only; K2 suppression; exports audited and formula-safe. FAIL found live (Sistem 403), fixed by 034 and re-checked as service_role |
| Error handling | PASS | standard result shape, errors logged, friendly messages bs/de/en |
| User experience | PASS | period links, "premalo učenika", empty states, print on every tab, phone layouts; in-app confirmation dialog with keyboard and Escape |
| Documentation | PASS | PDL-040, design approved, schema audit 033 and 034, CHANGELOG, README (VAPID, migration 030, restart after pull), user guide |
| Build and deploy readiness | PASS | build clean; no new dependency |
| Test data | DEFERRED BY DIRECTOR | removal is the last step before the deploy (PDL-038) |
| Post-deploy verification | N/A | no deploy in this sprint |
| Sprint-level learning | PASS | lessons consolidated, two Commander candidates |

Checks at close: typecheck, lint, check:text (100 files), Vitest 171/171, test:db (section 27), build, e2e 72/72;
Supabase security advisor: only the known Auth leaked-password WARN (mitigated in the app, PDL-030).

## Commander compliance
```
COMMANDER COMPLIANCE — Sprint 10
──────────────────────────────────
Rules followed without reminder:        20/23
Rules violated, caught by ACA:          1  (incomplete validation with <>, caught by the DB test before release)
Rules violated, caught by Director:     2  (Sistem tab failed live: probe ran as owner, not as the app's role;
                                            browser confirm box instead of the app's own UI)
Rules that slowed work or felt wrong:   none
New rules suggested by this sprint:     live probes under the app's role; stubs mirror platform privileges
```

## Handoff note
**Completed:** Director Command Center `/app/direktor` (Pregled, Predmeti, Nastavnici, Sadržaj, Sistem, Dnevnik;
periods; small-group protection K2 = 3; IDSS print; audited CSV); Director settings in Postavke with history (K5);
IDSS confirmation dialog for every confirmation; migration 034 fix; README steps for VAPID keys and migration 030.
**Waiting on the Director:** run migration 030 in the SQL editor; VAPID keys in `.env.local`; Vercel account of the
school and the DNS entry for `matura.idss.ba` (Sprint 11, L1 and L2).
**Waiting on the teachers:** blueprint confirmations, erratum DEU-4.3.34, first live mock exam.
**Risks:** the target launch 2026-10-06 depends on the teachers' confirmations and the hosting setup, not on code.
**Technical debt:** pdfjs-dist build warning (pre-existing); the user guide is still a source document.
**Next sprint (plan row 11):** hardening and launch: accessibility WCAG 2.2 AA, security adversarial pass,
performance, deployment preparation, clean start, production deploy on the Director's go.

Lessons captured: 10 entries in corrections/SPRINT_10_LESSONS.md
