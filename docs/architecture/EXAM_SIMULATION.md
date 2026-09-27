# Exam simulation design: mock exams and practice sets

Status: design (answer to the Director, 27.09.2026) · Implemented in Sprint 04 (trusted questions),
Sprint 06 (practice) and Sprint 07 (mock exams). Rules: CONSTITUTION P-3, P-4; AMB-05, AMB-09,
AMB-10, AMB-17; sources C12–C16, C20, C21 (`docs/discovery/SOURCE_INVENTORY.md`).

## 1. The legal anchor

The ministry decision for 2025/26 (C21, point III) states that the real matura tests are created
**exclusively from the tasks of the official exam catalogues**. The catalogues are the question
universe; the real test is a selection from it. EGE therefore simulates the exam the way the
ministry builds it: by selecting official catalogue tasks, never by inventing new ones (P-4).

## 2. Question pools (from the ingested catalogues, all untrusted until Sprint 04 review)

| Subject | Pool | Real test (canonical rules) |
|---|---|---|
| Matematika | 200 tasks: 50 osnovni (tasks 1–5 of each area), 100 srednji (6–15), 50 napredni (16–20) | 10 tasks: 1–4 basic, 5–8 medium, 9–10 advanced; 10 points; 60 min; no calculator (C12) |
| B/H/S | 200 questions: 121 multiple choice, 31 matching, 48 open/completion (types derived from wording, to be reviewed) | 18 questions: 12 MC, 4 completion, 2 matching; 10 points; 60 min (C13) |
| Njemački | 80 tasks = 200 scored items: 10 Hörverstehen, 10 Leseverstehen, 40 Wortschatz, 10 Grammatik, 10 Kommunikation | 5 areas × 2 points, 0.50 per item, listening first; 60 min (C14, C16) |

## 3. Two modes

**Probni ispit (mock exam)**: identical to the real test in structure, points, timing and allowed
aids. Every task is an official catalogue task, shown with its original wording (figures and
graphical options rendered from the original page region). Graded by the subject teacher (PDL-018):
the system pre-scores closed items with the catalogue's keys (with reviewed corrections, CF-03) as a
proposal, the teacher grades open items by the catalogue's scoring rules and confirms the result; the
student sees result, solutions and explanations only after that confirmation. The result is also shown as enrolment points
(matura points × 0.80, C20 Art. 12) for the edition valid in the student's school year (AMB-18).

**Vježba (practice)**: by subject, area and level; feedback after the student submits an answer (never
before, PDL-018), hints and explanations in the student's language (the question text stays in its source language, AMB-13); spaced repetition of
tasks answered wrongly; mastery per area.

## 4. Many different sets, few repetitions

A **blueprint** per subject describes the real test position by position (which catalogue level,
area and task type may fill each position). Mathematics follows C12 p.5 (AMB-09); B/H/S and German
are derived from the four official 2026 tests per subject and reviewed by the subject teachers
(AMB-10). Each blueprint is canonical data with provenance, not code.

The generator fills every position with an eligible **trusted** task:
1. never the same task twice in one set;
2. per student, tasks not seen yet first, then those seen longest ago (exposure history);
3. a task answered correctly in a recent mock exam is not reused until the pool for that position
   is exhausted; wrongly answered tasks return in practice, not in the next mock exam;
4. every generated set is stored (task list and order), so results stay reproducible and teachers
   can review exactly what a student saw.

The pools allow very many distinct tests: about 10¹⁵ for Mathematics, 10⁹ for German and more than
10¹⁵ for B/H/S. A student practising every week never meets the same test twice, and meets a single
task again only after the untouched part of its pool is used up.

Teachers can additionally **fix named sets** (e.g. "Probna matura A, B, C, D" for a whole class on
the same day), built by the same generator and approved before release.

## 5. What is deliberately not done

- No invented questions or answers in mock exams (C21 III, P-4).
- Practice **variants** (other numbers, new sentences): decided by the Director (AMB-17, 27.09.2026):
  never inside a mock exam; in practice only when the subject teacher approves the individual
  variant and it is labelled "Vježba (nije službeno pitanje)". Until that workflow exists, none.
- Nothing reaches students before the semantic review (Sprint 04) marks the task trusted.
