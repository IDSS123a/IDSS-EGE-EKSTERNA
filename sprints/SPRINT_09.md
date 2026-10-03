# SPRINT 09 — Support monitoring for the pedagogue and the psychologist

Status: **in progress** · Started 2026-10-03 (Director: "zatvori sprint08 sve uredu. Nastavi po planu")
Prerequisites met: Sprint 08 closed; PDL-032 (D1 to D5, readiness scale, AMB-24 resolved); design
`docs/architecture/SUPPORT_MONITORING.md`.
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, `CONSTITUTION.md` (P-4, P-7, P-13,
P-14), mandate §7A.3, §9, §11 to §13, ROLES_AND_PERMISSIONS §2 and §3.

## IN
1. **Data (migration 026):** read-only functions for the student overview, the student profile (five dimensions, areas,
   persistent errors, activity, mock exam trend, IDSS readiness) and group analysis; support notes (append-only,
   visibility per D1, no access for the superadministrator per D2, neutral types per D3); access audit on every
   profile read.
2. **Screens:** `/app/pracenje` (overview with user-set filters, print, CSV export), `/app/pracenje/[student]`
   (profile with notes), `/app/pracenje/analiza` (aggregates only); a link on the staff home.
3. **Carried over (Director):** blueprint confirmation by the three subject teachers, erratum DEU-4.3.34, first live
   mock exam.
4. **User guide:** chapter 04 and the personal pages of Adnana Agić and Medina Karaga describe the new screens.
5. **Added 2026-10-03 (Director: "idi dalje po planu", plan row 09, PDL-033):** subject teacher view of student
   progress scoped to the own subject, and the daily summary (PDL-018 item 3) as a page (migration 027).

## OUT
Class assignments and teacher (academic) notes (next sprint candidates); leaderboards.

## Acceptance criteria
- Only accounts with unscoped `students.view_progress` (pedagogue, psychologist, superadministrator) open the screens;
  support notes only for `support_notes.read_write`, and a "samo ja" note only for its author (DB tests).
- Every opening of a student profile writes an access audit row.
- No indicator labels a student; readiness follows PDL-032 exactly and says it is internal.
- CSV export contains no support note and is safe against formula injection.

## Progress
- [x] 1. Migration 026 applied live (three parts): overview, profile with access audit, group analysis, support notes
      (D1 to D3), readiness scale (PDL-032, mapping tested); DB tests section 21; security advisor only the known WARN.
- [x] 2. Screens: `/app/pracenje` (follow-ups, user-set filters, sortable table, print, CSV export safe against formula
      injection and audited), `/app/pracenje/[student]` (dimensions, areas, persistent errors, activity calendar, mock
      exam trend, readiness, support notes; print without notes), `/app/pracenje/analiza` (aggregates only); staff home
      link "Praćenje učenika"; unit tests for filters, readiness mapping and CSV.
- [x] 4. User guide: chapter 04, superadministrator chapter, personal pages of Adnana Agić and Medina Karaga,
      screenshot list.
- [x] 5. Migration 027 applied live (one call): monitoring narrowed to the reader's subjects, daily summary; DB tests
      section 22 (11 assertions); live check: Haris Hamzić sees only Mathematics; screens `/app/pracenje` (subject
      filter only with more than one subject), `/app/pracenje/dan` (day picker, print); staff home links for teachers;
      unit tests for the summary day; guide chapter 02 and the teachers' personal pages.
