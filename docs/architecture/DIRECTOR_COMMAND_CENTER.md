# Director Command Center

Status: **approved 2026-10-04 (PDL-040: K1 to K6 as proposed, K2 minimum group 3), implemented in Sprint 10** · Sources: mandate §13 ("institutional intelligence
layer, not a surveillance dashboard"; participation, subject and class progress, aggregate mastery, teacher activity,
content health, system health, audit activity, configuration and permissions; "minimize exposure of sensitive student
information; use aggregation wherever individual-level detail is not necessary"), §7A.7, §11; ROLES_AND_PERMISSIONS §2
(institution analytics, audit log and security events: superadministrator); CONSTITUTION P-4, P-7, P-13, P-14;
PDL-036 (IDSS print and export) · Implementation plan row 10.

## 1. Principles
1. **Aggregate first.** Every view shows counts and shares for the school; a single student appears only where the
   Director opens Praćenje učenika (already built, audited).
2. **No surveillance.** No time-on-site, no login timelines of staff or students, no rankings of people.
3. **Facts with definitions**, no invented thresholds (P-4): a value the Director wants as a signal is a setting he sets.
4. **Every view prints and exports in the IDSS format** (PDL-036); exports are audited.

## 2. Screens (`/app/direktor`)
| Tab | What it shows | Source |
|---|---|---|
| Pregled | active students; students who practised in the last 7 and 30 days; answers per week (12 weeks); mock exams requested, submitted, graded; assignments open, completed, missed; gifts given | practice, mock exams, assignments, gifts |
| Predmeti | per subject: trusted questions, coverage (answered at least once by the group), group accuracy, mastery share, graded mock exam points distribution, readiness distribution (100, 90, 80, below 80, not available, PDL-032) | support functions, aggregates only |
| Nastavnici | per teacher (K1): records reviewed, rules confirmed, practice answers reviewed, mock exams graded, assignments given, gifts given, teacher notes written; open work waiting (answers, exams) | audit and work tables |
| Sadržaj | content health per subject: records accepted, pending, returned; text revisions; errata open and withdrawn; follow-ups open; blueprints loaded and confirmed (by whom); retrieval index built and up to date; questions most often answered wrongly (group) | canon and review tables |
| Sistem | last ingestion jobs; failed sign-ins and lockouts (security events, last 30 days); push configured yes or no; migrations waiting for the Director (e.g. 030); Supabase advisor status as last recorded | security events, settings, schema history |
| Dnevnik | audit log with filters (action, person, entity, period); details as stored (never note or message content, M-15); export CSV, audited | audit_logs (audit.view) |
| Postavke | the settings the Director owns (K5) | system_settings |

## 3. Data
Migration 033: read-only functions `director_overview`, `director_subjects`, `director_teachers`, `director_content`,
`director_system`, `director_audit(filters, page)`; all require `analytics.view_institution` (and `audit.view` for the
log), service_role only, no new table except what K5 needs. DB tests: refused for teachers, pedagogue, psychologist and
students; no function returns note or message content.

## 4. Decisions of the Director (PDL-040)
Answer 2026-10-04: "prihvatam. K2 3". Every proposal below is accepted; K2 uses a minimum group of 3 students.

- **K1 Teacher activity by name.** Proposal: yes, counts of completed work per teacher (no times, no logins), so the
  Director sees where support is needed; alternatively only per subject.
- **K2 Small-group protection.** With few students an aggregate can reveal one student. Proposal: below a minimum group
  size the Director sets, a cell shows "premalo učenika"; or no protection, since the Director may open every profile
  anyway.
- **K3 Periods.** Proposal: last 7, 30 and 90 days and "cijela školska godina" (from the active school year's start;
  the school year and the generation IX 2026/27 are entered in Upravljanje nalozima first).
- **K4 Audit log.** Proposal: read, filter, export; nothing editable (append-only); retention follows PDL-038 D-A.
- **K5 Settings the Director owns.** Today only the splash colours. Proposal: move into Postavke, with audit and a
  history of values: the daily mission goal (now 5 answers, a code constant), the IDSS points values and badge rules
  (now `config/gamification.json`). Exam rules and scoring stay canon and are never settings (P-15).
- **K6 Daily summary for the Director.** Proposal: the same daily summary as teachers (all subjects) linked from the
  command center; no e-mail.
