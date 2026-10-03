# Support monitoring for the pedagogue and the psychologist (design)

Status: approved by the Director 2026-10-03 (PDL-032) · Sources: mandate §7A.3, §9, §11, §12, §13; CONSTITUTION P-4,
P-7; ROLES_AND_PERMISSIONS §2, §3 · Users: Adnana Agić (pedagogue), Medina Karaga (psychologist)

## 1. Principles
1. **One question per screen** (mandate §11): how does this help us give this student better support?
2. **Evidence, not labels.** Every indicator is an observable count or share from the student's own data, with its
   definition one click away. The app never computes psychological, medical, intelligence or personality judgements,
   and never a "risk" label: a threshold that turns data into a label would be invented (P-4). Staff filter and sort;
   people judge.
3. **Several dimensions, never one percentage** (mandate §9): completion, accuracy, mastery, consistency and exam
   performance are shown side by side. Readiness is the Director's internal IDSS scale (PDL-032), labelled "interni
   pokazatelj IDSS-a, nije službena procjena": per subject, last three consecutive graded mock exams, 0 errors 100 %,
   1 to 2 errors 90 %, 3 errors 80 % (open points in AMB-24).
4. **Own progress first.** Comparisons are with the student's own earlier performance; cohort figures appear only as
   aggregates, never as a ranking of named students.
5. **Purpose limitation and audit.** Pedagogue and psychologist see learning data of all students (their institutional
   role) and their own support notes; every opening of an individual student profile writes an access audit row.
6. **IDSS points are motivation.** They are shown apart from learning indicators, labelled "nije ocjena".

## 2. Indicators (all per student, per subject and in total)
| Dimension (mandate §9) | Indicator | Definition (shown in the app) | Source |
|---|---|---|---|
| Completion | Answered questions | distinct catalogue questions answered at least once, of all trusted questions | practice_answers |
| Accuracy | Share correct | correct answers of all checked answers in the last 30 days and overall | practice_answers, teacher verdicts |
| Mastery | Mastered questions | questions whose latest answer is correct (the Game Hub measure) | practice_answers |
| Mastery by area | Area table | per catalogue area: answered, latest correct, share | question_versions.area |
| Persistent errors | Repeated mistakes | questions answered wrongly at least twice whose latest answer is still wrong; links to the question as printed | practice_answers |
| Consistency | Practice days | days with practice in the last 7, 30 days; current streak; last activity date | practice_answers |
| Consistency | Daily missions | days the mission was completed in the last 30 days | practice_answers |
| Exam performance | Mock exams | per subject: points of each graded exam, first and latest, change against the student's own previous exam | mock_exams (graded only) |
| Exam behaviour | Time and completeness | time used of the official duration; units left without an answer; automatic submission | mock_exams, items |
| Waiting work | Open items | practice answers waiting for a teacher, exams waiting for grading | queues |

## 3. Screens
### A. Praćenje učenika (`/app/pracenje`)
A table of all students: name, last activity, practice days (7/30), answered, share correct (30 days), mastered per
subject, latest mock exam per subject, open items. Tools:
- sort by any column; filter by subject;
- filter "bez vježbe u zadnjih N dana" where **the user picks N** (no system threshold);
- filter "pad na probnom ispitu" = latest graded exam below the student's previous one (a factual comparison);
- print and CSV export of the visible table (CSV injection safe; no support notes).
### B. Profil učenika (`/app/pracenje/[student]`)
- Header: name, last activity, IDSS points (separate box, "nije ocjena").
- Per subject: the five dimensions as small figures, the area table (weakest areas first by share correct among
  answered questions), persistent errors with the printed question, practice history (last 50 answers).
- Activity calendar of the last 60 days.
- Mock exams: list with points, time used, empty units, teacher notes; own trend (first, previous, latest).
- Support notes (section D).
- Print view of the profile without notes; notes print separately and only for the author's audience.
### C. Analiza grupe (`/app/pracenje/analiza`)
Aggregates only: activity per week; per subject and area the share correct over all students (where support is
needed as a group); distribution of graded mock exam points per subject (count per whole point); the catalogue
questions most often answered wrongly (links to the printed question, useful for teachers too).
### D. Bilješke podrške
Written by the pedagogue or the psychologist on the student profile: date, text, optional follow-up date, visibility.
- Visibility: "samo ja" or "pedagog i psiholog" (decision D1).
- Optional neutral type: razgovor s učenikom, razgovor s roditeljem, dogovor, praćenje (decision D3); no diagnostic or
  personality categories.
- Append-only with corrections as new entries; every read and write audited; never in exports, never visible to
  teachers or students.
- "Dogovoreni sljedeći koraci": a list of follow-up dates due, on the start screen of the pedagogue and psychologist.

## 4. Pedagogue and psychologist
Same indicators and tools (both hold `students.view_progress`, `support_notes.read_write`, `reports.export`). The
difference is in the notes: by default the psychologist's notes are "samo ja" and the pedagogue's "pedagog i psiholog"
(proposal in D1).

## 5. Data and security
- Migration 026: read-only functions `support_overview`, `support_student`, `support_patterns` (service_role only,
  re-check `students.view_progress`, write the access audit row for a profile); `support_notes` table with RLS by
  author and visibility, append-only, audited functions to write; tests: a teacher or student reads no note, a note
  marked "samo ja" is invisible to the other support role, exports contain no note.
- No new data is collected from students; everything is derived from practice and mock exams.

## 6. Decisions (accepted 2026-10-03, PDL-032)
- **D1** Note visibility default: proposal psychologist "samo ja", pedagogue "pedagog i psiholog".
- **D2** Does the superadministrator read support notes? Proposal: no (ROLES §3 default); aggregates only.
- **D3** Neutral note types as listed in D, or free text only.
- **D4** Persistent error = wrong at least twice and latest still wrong (proposal).
- **D5** Readiness: the Director's internal scale replaces "not shown" (PDL-032, AMB-24).
