# SPRINT 06 — Student Game Hub & practice (with carry-overs)

Status: **in progress** · Started 2026-09-27 ("kreni Sprint 06", Director)
Prerequisites met: Sprint 05 closed; 494 trusted questions, retrieval index live; PDL-018 (answers after the student's
answer or the teacher's grading).
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS, C-1…C-5, `CONSTITUTION.md`
(P-3, P-4, P-7, P-13, P-14), `docs/architecture/EXAM_SIMULATION.md`, PDL-016, PDL-018, AMB-19.

## IN
0. **Carry-overs from the Director (27.09.2026):** splash colour shares in percent (PDL-020), product name
   "IDSS - External Graduate Examination", footer with legal documents (texts written, AMB-20), own password change
   for every account.
1. **AMB-19:** reviewed text revisions for the six trusted questions with footnote text (printed source untouched).
2. **Semantic search with Gemini** (Director added the key to `.env.local`): embedding provider behind
   `CanonRetriever`, model name verified at start, index built on the Director's machine; only catalogue and query text
   leave the app (Privacy Policy).
3. **Student Game Hub:** student home, subject pages, progress by area.
4. **Practice loop** over trusted questions: the solution only after the student's answer (PDL-018); closed items checked
   by the key (with revisions, CF-03); open answers stored for the teacher; mastery per area; missions v1.

## OUT
Mock exams and teacher grading (Sprint 07), XP and badges (Sprint 08), staff dashboards (Sprint 09).

## Acceptance criteria
- A student never receives an answer key before submitting an answer (RLS and action tests).
- A student can practise every trusted question of the three subjects; closed items are checked by the key.
- Every account can change its own password; a wrong current password counts towards the login lockout.

## Progress
- [x] 0a. Splash shares in percent: `/app/postavke`, migration 012 (PDL-020); reference FLOW algorithm with fitted colour weights (PDL-022).
- [x] 0b. Product name in every app text.
- [x] 0c. Footer and legal documents (bs/de/en), AMB-20 resolved.
- [x] 0d. Own password change `/app/nalog` (current password verified with a session-less client; failed attempts
      feed the login lockout; audited).
- [x] 1. AMB-19 text revisions: migration 013 (applied live), review screen section "Tekst pitanja za učenike" with
      prepared proposals for the five Math questions (PDL-021); DEU-4.2.5 is printed text, unchanged. Waiting for a
      reviewer to confirm the five proposals in the app.
- [ ] 2. Gemini semantic search
- [ ] 3. Game Hub
- [ ] 4. Practice loop, mastery, missions v1
