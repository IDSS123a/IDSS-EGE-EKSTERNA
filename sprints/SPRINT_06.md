# SPRINT 06 — Student Game Hub & practice (with carry-overs)

Status: **closed** 2026-09-27 · Started 2026-09-27 ("kreni Sprint 06", Director) · Closed after "nastavi sa narednim korakom"
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
      reviewer to confirm the five proposals in the app. Confirmed by the Director 27.09.2026, AMB-19 resolved; migration 014
      (no-op revisions refused, line breaks normalised).
- [x] 2. Gemini semantic search: migration 015 (applied live), `gemini-embedding-2` over REST, index build and search by
      meaning fused with word search, fallback to words (PDL-023). The Director builds the index on his computer
      ("Izgradi indeks po značenju"); the similarity floor 0.6 is tuned on the first real searches.
      Live (27.09.2026): the Director built the index on his computer, 514 of 514 passages with vectors (first run
      stopped at 100, fixed by retry and isolation, PR #31). Check in the database: every vector has unit length; the
      nearest other passage is from the same subject for 99.6 % (B/H/S), 100 % (German) and 100 % (Math).
- [x] 3. Game Hub: `/app` for students (streak, daily mission, three subjects with mastery), `/app/predmet/[code]` (areas).
- [x] 4. Practice loop, mastery, missions v1: migrations 017 and 018 (applied live), `/app/vjezba`; solution only after
      the answer; auto-check where the key is an option letter or r/f (B/H/S 121/121, Math 49/50, German 156/156 items);
      other tasks stored for the teacher with the printed solution (AMB-21); mastery = latest answer correct; daily
      mission 5 answers and streak (PDL-024). No student accounts exist yet: the Director creates one to try it.
- [ ] Search quality: not accepted by the Director after PDL-025 (27.09.2026, "Ne valja tražilica. Na nju ćemo se vratiti
      kasnije."). Carried over: agree a test set of questions with expected sources first, verify live, then hand over.

## DONE_CHECKLIST (Commander 1.6.1) — 2026-09-27

Evidence: typecheck ✔ · lint ✔ (0 warnings) · `check:text` ✔ · Vitest 117/117 · `npm run test:db` ✔ (sections 14 to 17) ·
build ✔ · Playwright 68/68 · security advisor: only the known Auth WARN (leaked-password protection) · performance
advisor: INFO only (unused indexes, no traffic yet) · live: migrations 012 to 018 applied, 514/514 vectors, practice
payload checked over every live question.

| Area | Item | Result |
|---|---|---|
| Code quality | tsc zero errors; no `any` / `@ts-ignore` / `console.log` / TODO in new code | PASS |
| | No hard-coded values (paths, limits, mission goal, models, z floor are constants; colours are tokens) | PASS |
| | Browser console on changed screens | PARTIAL: review, settings, legal, account and search screens used live by the Director; Game Hub and practice not yet rendered with a real student account (none exists). The Director's first student sign-in is the check. |
| Architecture | Queries only in repositories; permissions in `lib/permissions.ts`; domain logic framework-free (`progress.ts`, `flow.ts`, `context.ts`, `text-revision.ts`) | PASS |
| | AI through provider interfaces (`Embedder`, `AnswerModel`, `CanonRetriever`) | PASS |
| | Multi-layer shapes (practice payload, revision text, splash weights) enumerated; round trips verified live | PASS |
| Security | Server Actions: authenticate, authorise, Zod; database functions re-check capabilities (service_role only) | PASS |
| | RLS on new tables (`question_text_revisions`, `canonical_chunk_embeddings`, `practice_answers`); students never read keys (practice_next returns no key; RLS tests) | PASS |
| | Keys: Gemini keys server only, header not URL; no key in client code | PASS |
| | Live adversarial pass | PASS for grants (all new functions service_role only; signed-in users cannot call practice functions, DB test); not yet with a live student session |
| Error handling | try/catch; failed writes audited; machine codes localised; Gemini detail shown without the key | PASS |
| UX | Loading states, empty states, errors in bs/de/en; 320 to 2560 px layout e2e | PASS |
| | Search quality | FAIL: not accepted by the Director; carried over with a test-set-first plan (lesson 12) |
| Documentation | JSDoc; schema-audit 012 to 018; CHANGELOG; PDL-020 to PDL-025; AMB-19 resolved, AMB-20 resolved, AMB-21 open | PASS |
| | `.env.example` | PASS (GEMINI_API_KEY_1..n, GEMINI_ANSWER_MODEL) |
| Build/deploy | Build green; no new dependency | PASS |
| | Test data | PASS (live probes in rolled-back transactions; revisions and index are the Director's real actions) |
| | Rate limit N / N+1 | N/A (no new rate limit; login lockout unchanged and tested) |
| Post-deploy | Production URL | N/A (not deployed; Director: later) |
| Learning | `corrections/SPRINT_06_LESSONS.md` consolidated | PASS |

COMMANDER COMPLIANCE — Sprint 06
──────────────────────────────────
Rules followed without reminder:        24/30 (M-2, M-3, M-4, M-5, M-13, M-18, M-23, P-4, P-13, P-14, E-1, E-2, E-3, E-4, E-5, E-6, E-9, E-11, E-13, E-14, A-2, A-3, A-4, A-5)
Rules violated, caught by ACA:          4 (E-11: splash measuring tool lived in the scratchpad; E-13: lint warnings reached main in PR #29; E-10: German Wortschatz fallback found by the full live payload check; E-10: shared radio name found before first render)
Rules violated, caught by Director:     6 (E-10 hand-off not followed on the real screen; E-10 own-account basics missing; E-10 button style on links; M-2 reference approximated instead of ported; E-10 index build without error detail; E-10 search relevance tuned without a test set, three rounds)
Rules that slowed work or felt wrong:   none
New rules suggested by this sprint:     1 (evaluation set before shipping AI quality changes; lessons file)

HANDOFF NOTE — Sprint 06
Completed: splash colour shares in percent with the exact reference FLOW port (PDL-020, PDL-022); product name in every text; professional legal documents with GDPR, DPO and IDSS identity (AMB-20); own password change for every account; AMB-19 text revisions (migrations 013, 014) confirmed live; Gemini embeddings with ten rotating keys and a live index of 514/514 (migrations 015, 016); student Game Hub, subject pages and practice loop with solutions only after the answer, auto-check for option and true/false items, mastery, daily mission and streak (migrations 017, 018, PDL-024).
Not completed: search quality (rejected by the Director after PDL-025; parked, test-set-first plan); figures in practice (a page reference is shown instead); teacher view of open practice answers (Sprint 07 grading).
Open risks: Game Hub and practice not yet used by a real student account; AMB-21 (key formats for matching, completion and word bank) keeps those tasks with the teacher; 492 bulk-accepted questions not individually reviewed (PDL-016).
Technical debt: shadcn/ui deviation (PDL-010); Sentry deferred; leaked-password protection still off in Supabase Auth; Vercel deployment postponed; answer-model search path never called live.
Lessons captured: 21 entries in corrections/SPRINT_06_LESSONS.md.
Next sprint: Sprint 07 — Mock exams and teacher grading (PDL-018, EXAM_SIMULATION.md): exam blueprint from the confirmed rules of the active catalogue, generated and stored mock exams per subject with the official time limit, submission, pre-scored closed items, teacher grading queue for open items including practice answers awaiting the teacher, results released only after the teacher confirms, student notification.

