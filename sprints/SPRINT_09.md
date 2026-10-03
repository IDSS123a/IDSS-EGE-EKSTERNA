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
   mock exam. **Postponed 2026-10-03 (Director):** the teachers do it when they have time; not a sprint blocker.
4. **User guide:** chapter 04 and the personal pages of Adnana Agić and Medina Karaga describe the new screens.
5. **Added 2026-10-03 (Director: "idi dalje po planu", plan row 09, PDL-033):** subject teacher view of student
   progress scoped to the own subject, and the daily summary (PDL-018 item 3) as a page (migration 027).
6. **Added 2026-10-03 (Director: "idemo dalje", plan row 09, PDL-034):** academic teacher notes (migration 028);
   assignments designed (`docs/architecture/ASSIGNMENTS.md`), built after the Director's decisions Z1 to Z6.
7. **Added 2026-10-03 (Director, PDL-035, PDL-036):** uniform IDSS print and export format for every analysis and
   result; assignments as decided (group and single students, both content kinds, required due date, card plus in-app
   notification and Web Push); special gifts design proposal (G1 to G6).

## OUT
Building assignments before decisions Z1 to Z6; leaderboards.

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
- [x] 6. Migration 028 applied live: teacher notes (own subject for the teacher, all subjects for the support roles and
      the superadministrator, never the student), DB tests section 23 (13 assertions); profile shows them per subject,
      out of print; unit tests for the input; assignments design proposal with decisions Z1 to Z6.
- [x] 7a. Uniform IDSS print and export format (PDL-036): letterhead and page footer on every analysis and result,
      IDSS CSV for overview, daily summary and group analysis; unit tests; PDF checked.
- [x] 7b. Assignments (migrations 029 live, 030 for the Director, PDL-035): teacher list and form, detail with withdrawal,
      print and CSV; student card, assignment practice, profile section; DB tests section 24; unit tests.
- [x] 7c. Web Push (migration 031 live, PDL-037): service worker, per-device switch, sender; DB tests section 25. Live
      push needs the Director's VAPID keys in `.env.local`.
- [ ] 3. Postponed by the Director until the teachers have time (blueprints, DEU-4.3.34, first live mock exam).
- [x] 8. Clean start before production recorded (PDL-038, `docs/PRODUCTION_READINESS.md`, CLAUDE.md non-negotiable).
- [x] 9. Special gifts (migration 032 live, PDL-039 G1 to G6): `/app/vitrina` with six procedural 3D gifts and the
      unboxing, teacher form and list on the profile, hub card, push notice; DB tests section 26; unit tests; renders
      checked in headless Chromium (desktop and phone).
- [x] 10. Exit criterion of plan row 09, "privacy boundaries verified live" (2026-10-04): every live account was
      impersonated through RLS (role `authenticated`, its own JWT `sub`) in one rolled-back transaction; direct reads:

      | Account | Profiles | Practice answers | Support notes | Teacher notes | Gifts | Assignments | Audit | Answer keys | Bundles |
      |---|---|---|---|---|---|---|---|---|---|
      | a.b. (student) | 1 (own) | 28 (own) | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
      | Haris Hamzić (Math) | 7 (accounts.view) | 0 (no Math answers) | 0 | 0 | 0 | 0 | 0 | 200 (Math) | 2 (own) |
      | Nikolina Todorović (German) | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 200 (German) | 2 |
      | Nizama Memija (B/H/S) | 7 | 28 (B/H/S) | 0 | 0 | 1 (given by her) | 1 (B/H/S) | 0 | 200 (B/H/S) | 2 |
      | Pedagogue, psychologist | 7 | 28 (all subjects) | 0 | 0 | 0 (functions only) | 1 | 0 | 0 | 2 |
      | Director (superadmin) | 7 | 28 | 0 (D2) | 0 | 0 (functions only) | 1 | 704 | 600 | 10 |

      Result: no account reads data outside its role; the student reads no key, note, audit row or other student;
      teachers read keys and answers of their own subject only; support notes stay with their authors (none exist yet).
