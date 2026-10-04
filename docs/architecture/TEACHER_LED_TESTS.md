# Teacher-led tests (design proposal)

Status: **approved 2026-10-04 (PDL-043: proposals 1 to 4 and T1 to T6)** · Date: 2026-10-04
Trigger: the Director's restatement of the product logic: "Nastavnik je vlasnik cijelog procesa pripreme učenika za
eksternu maturu. Nastavnik može dati pitanja grupi učenika ili pojedinačno učeniku. Nastavnik prati razvoj svakog
učenika i može grupi učenika ili pojedinačnom učeniku poslati cijeli test ili samo dijelove testa gdje vidi da učenik
ima slabije znanje."
Sources: P-15 (mock exams only as the canonical documents prescribe), PDL-018, PDL-027, PDL-033, PDL-035 (Z1 to Z6),
migrations 019, 022, 027, 029.

## 1. What the app does today (verified in code and database)
| Director's logic | Today | Evidence |
|---|---|---|
| Teacher gives questions to a group or to one student | **Yes.** Assignment: picked catalogue keys (up to 50) or N questions drawn from one area; all students or chosen ones; required due date; withdraw; progress per student | migration 029 `assignment_create`; `/app/zadaci` |
| Teacher follows each student's development | **Yes**, own subject: profile (five dimensions, weakest areas first, persistent errors), mock exams, assignment states, teacher notes, daily summary | migrations 026, 027, 028; `/app/pracenje/[student]`, `/app/pracenje/dan` |
| Teacher sends a **whole test** to a group or one student | **No.** A mock exam is started only by the student (`mock_exam_start` takes the student's own person); the teacher approves or discards the generated set, then grades | migrations 019, 022, 024 |
| Teacher sends **parts of a test** where the student is weak | **Partly.** An assignment can take N questions from one area, or chosen keys; it is practice with immediate feedback, not a test (no time limit, no teacher grading, one area per assignment); the profile has no "assign this weak area" shortcut | migration 029; `student-profile-screen.tsx` |

So the teacher owns questions and monitoring, but not the test itself: the test is still student-initiated.

## 2. Proposal
1. **Teacher sends a whole mock exam** (to all students of the subject or to chosen ones). For each recipient the
   system composes a set exactly as the confirmed blueprint prescribes (P-15, as today), the teacher reviews and
   approves each set (as today), and the student sees it on the Game Hub with the due date; timer, writing,
   pre-scoring, teacher grading and release work as today.
2. **Teacher sends part of a test**: chosen blueprint positions (for example only positions 6 to 8 of Mathematics,
   the ones the student fails). Composition, approval and grading as in 1, limited to those positions; the result is
   labelled "dio testa" and never counted as a full mock exam (no readiness indicator from it, PDL-032).
3. **From the student's profile**: next to each weak area, "Zadaj vježbu iz ove oblasti" and "Pošalji dio testa"
   open the forms with the student and the area or positions already filled in.
4. Notices: in-app and Web Push as for assignments (PDL-037).

## 3. Decisions for the Director
- **T1 Whole test from the teacher:** yes, as above? Should students still be able to request a mock exam
  themselves (today's flow), or only the teacher sends tests?
- **T2 Part of a test:** by blueprint positions (official test structure) as proposed, or by catalogue areas?
- **T3 Time limit for a part:** proportional to the official time for the chosen positions, or no limit? (The
  official time comes from the canon; a proportion is an IDSS rule and needs the Director's approval, P-4.)
- **T4 Approval:** the teacher approves every generated set before the student sees it (as today), also when sending
  to a whole group?
- **T5 Counting:** a part of a test gives no readiness indicator and no "full mock exam" badge; IDSS points per answer
  as today?
- **T6 Timing:** build before the launch on 2026-10-06 (the launch moves), or launch with today's logic and build this
  right after as the first change?

## 4. Estimate (after T1 to T6)
Forward migration (teacher-initiated exams and parts, notices), teacher forms, profile shortcuts, student card, DB and
unit tests, guide: about 1.5 to 2 working days; estimated 1.2M to 2M ACA tokens (assumption: one implementation pass,
one verification pass, current repository size).
