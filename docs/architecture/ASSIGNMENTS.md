# Teacher assignments (design proposal)

Status: **proposal, waiting for the Director (decisions Z1 to Z6)** · Sources: mandate §7A.3 ("Teacher: teach, assign,
monitor and intervene"), §11 ("completed and missed missions/assignments", "teacher-assigned learning activities"),
§12 ("assigned work"); ROLES_AND_PERMISSIONS §2 ("Assign practice / missions": superadministrator, subject teacher
scoped); DATA_MODEL §7, §9; CONSTITUTION P-4, P-7, P-15 · Implementation plan row 09.

## 1. What an assignment is
A subject teacher gives students a piece of **practice from the catalogue**: a set of trusted catalogue questions of
the own subject, with an optional due date and a short instruction. The student finds it on the Game Hub under
**Zadaci nastavnika**, practises those questions in the normal practice loop (same feedback, same rules: the solution
only after the answer, PDL-018), and sees which questions of the assignment are done. Nothing new is invented: the
questions are catalogue questions (P-15), and the assignment never changes a score or a mock exam.

## 2. Who sees what
| | Teacher of the subject | Pedagogue, psychologist | Superadministrator | Student |
|---|---|---|---|---|
| Create, withdraw | own subject | no (ROLES §2: "—") | yes | no |
| Progress per student | own subject | yes (profile: completed and missed, mandate §11) | yes | own only |
| Daily summary | open and missed assignments of the day | yes | yes | no |

Assignments are append-only: a withdrawal is a new record with a reason; nothing is deleted.

## 3. Facts shown (no label, P-4)
Per assignment and student: questions answered of the assignment, of them correct (latest answer), answered before the
due date or after it, open. "Missed" is a fact: the due date passed and not every question was answered. No grade,
no ranking.

## 4. Decisions for the Director
- **Z1 Recipients.** There are no classes in the database yet (enrolments are empty). Proposal: the teacher chooses
  "all active students" or selected students by name; classes come later, when the Director sets up the generation
  (IX 2026/27) and class labels.
- **Z2 Content.** Proposal: (a) catalogue questions picked by the teacher (by key, e.g. MAT-5.3.7, or from an area
  list), or (b) "N questions from area X" drawn by the app from trusted questions. Both only from the own subject and
  only trusted questions.
- **Z3 Completion.** Proposal: an assignment is complete for a student when every assigned question has an answer
  given after the assignment was created (any outcome); correctness is shown beside it, not mixed into "complete".
  Open answers waiting for the teacher count as answered.
- **Z4 Due date.** Proposal: optional; without a due date nothing is ever "missed".
- **Z5 IDSS bodovi.** Answers already earn points through practice (PDL-029). Proposal: no extra points for an
  assignment until the Director sets a value in `config/gamification.json` (we do not invent one, P-4).
- **Z6 Notice to the student.** Proposal: a card **Zadaci nastavnika** on the Game Hub, shown on every visit while an
  assignment is open; no stored notification (a new notification kind needs a DROP CONSTRAINT run by the Director in
  the SQL editor). If the Director wants a notification as well, migration 029 includes it and is handed over.

## 5. Data (after approval)
Migration 029: `assignments` (subject, author, title, instruction, due date, recipients mode, created_at),
`assignment_questions`, `assignment_recipients`, `assignment_withdrawals`; RLS: staff of the subject read, the student
reads own open assignments through a function only; functions `assignment_create`, `assignment_withdraw`,
`assignments_of_student`, `assignment_progress`; audit on create and withdraw; DB tests for scope, student isolation
and completion.
