# SPRINT 08 — Mock exams live, teacher review of practice answers, motivation

Status: **in progress** · Started 2026-10-03 (Director: "uredu. nastavi po planu" after the Sprint 07 handoff)
Prerequisites met: Sprint 07 closed; PR #39 merged; migrations 019 to 023 live; 500/500 trusted questions.
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, `CONSTITUTION.md` (P-4, P-7, P-13,
P-14, P-15), PDL-018, PDL-024, PDL-027, mandate §8.3 and §8.4.

## IN
1. **Live walk-through (Director):** blueprints loaded and confirmed by the three subject teachers; one mock exam per
   subject from request to released result; erratum DEU-4.3.34 entered in the review screen.
2. **Teacher review of open practice answers:** the subject teacher's queue of practice answers awaiting a verdict
   (migration 021 `practice_review_queue`, `review_practice_answer`), with the printed key and errata beside the answer.
3. **Notification when a set waits for approval:** teachers of the subject (superadministrators when none) are notified
   when a student requests a set.
4. **XP and badges (P-7, mandate §8.3, §8.4):** event-driven, never part of scoring, never shown as a grade; values are
   a Director decision (the mandate sets none), recorded before implementation.
5. **Leaked-password protection** in Supabase Auth (security advisor WARN since Sprint 01).

## OUT
Levels, challenges and leaderboards (later); search (parked); daily teacher summary and dashboards (Sprint 09).

## Acceptance criteria
- A teacher sees only practice answers of the subjects they grade; a verdict is audited and changes the student's
  practice outcome, never a mock exam score.
- Every notification has a recipient even when the subject has no teacher.
- XP is stored apart from scores; a test proves that no XP event changes points or results.

## Progress
- [x] 2. Teacher review of open practice answers (2026-10-03): `/app/ocjenjivanje/vjezba` with the question as printed,
      the student's answer beside the printed key and errata, verdict correct / partly correct / incorrect with an
      optional note (review_practice_answer, audited); the grading area links to it with the waiting count. Live: 7
      answers wait (payload checked through practice_review_queue).
- [ ] 3. Set request notification: migration 024 written and tested (DB test section 18), app shows the new kind;
      waits for the Director to run 024 in the Supabase SQL editor (DROP CONSTRAINT).
- [ ] 4. XP and badges: value proposal sent to the Director (PDL-029, proposed); implementation after approval.
- [ ] 5. Leaked-password protection: a Supabase Auth dashboard switch for the Director.
- [ ] 1. Live walk-through (Director).
