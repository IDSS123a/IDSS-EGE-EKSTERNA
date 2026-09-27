# SPRINT 05 — Retrieval over trusted canon (RAG foundation, no external AI yet)

Status: **closed 2026-09-27** · Started 2026-09-27 ("kreni sa Sprint 05", Director)
Director decision (2026-09-27): build the retrieval layer now with PostgreSQL full-text search, no external
AI service and no key; Gemini embeddings (DL-005) plug in later through the same interface (PDL-017).
Prerequisites met: Sprint 04 closed; 494 trusted question versions, 20 confirmed rules.
Required reading (Tier 2): Commander M-1…M-5, ENGINEERING_RULES, ARCHITECTURE_PATTERNS (A-5), C-1…C-5,
`CONSTITUTION.md` (P-3, P-4, P-5, P-6), `docs/architecture/ARCHITECTURE.md` §6, DATA_MODEL §5.

## IN
1. **Chunks** (`canonical_chunks`): one chunk per trusted question version (canonical text, area, level, task type)
   and per canonical rule (value quotes), each with subject, document version, page and a citation; built by the
   server from trusted content only (never untrusted ingested records, never answer keys).
2. **Retrieval** `retrieve_canon()`: filters active versions and subject **before** ranking; full-text ranking with
   diacritic folding (č/ć/đ/š/ž, ä/ö/ü/ß) so "cetverougao" finds "četverougao"; bounded k; every call writes a
   `retrieval_audit_logs` row (query hash, filters, returned chunk ids, actor); superseded content is never returned.
3. **Provider interface** (A-5): `CanonRetriever` with the full-text implementation; the embedding implementation
   is added with the Gemini key without touching callers.
4. **Grounding and refusal**: a framework-free context builder that turns results into cited, delimited source
   blocks and refuses (fixed text) when nothing relevant is found; retrieved text is treated as data
   (injection tests: SQL, delimiter breakout, instruction-like text in queries and sources).
5. **Staff search screen** `/app/pretraga` (canon.review for own subjects, canon.publish all): query, subject,
   cited results with a link to the reviewed record; "Izgradi indeks" for canon.publish with chunk counts.

## OUT
Embeddings and any external AI call (after the Director adds a Gemini key), AI tutor answers, student access
(Sprint 06), historical/audit retrieval of superseded content (only via the registry).

## Acceptance criteria
- Superseded or non-active content is never returned (DB test).
- A reviewer gets results only for their own subjects; students and anon get nothing (DB tests).
- Every retrieval is audited; queries are stored only as SHA-256 hashes.
- Injection strings in the query or in source text never change the SQL or break out of a source block (tests).
- No result above the relevance floor gives the fixed refusal, never an invented answer.

## Progress
- [x] 1. Migrations 009 (chunks, retrieval audit, build and retrieve), 010 (OR query) and 011 (ranking) applied to
      Supabase; DB tests (retrieval section: scope, superseded never returned, audit hash, injection, function words);
      security advisor only the known Auth WARN.
- [x] 2. `features/retrieval`: `CanonRetriever` interface with the full-text implementation, grounded context builder
      (fixed instruction, numbered cited source blocks, neutralised markers) and refusal; Vitest 68/68.
- [x] 3. `/app/pretraga` (reviewers: own subjects; Superadmin: all and "Izgradi indeks"), bs/de/en, nav link;
      fixture render at 1440 and 390 px without horizontal scroll; Playwright 56/56.

Live check on real data (rolled back, 514 chunks = 494 questions + 20 rules):
| Question | Top source |
|---|---|
| Koliko traje ispit iz matematike? | exam.duration_minutes |
| koliko bodova nosi povezivanje | exam.scoring |
| Pitagorina teorema pravougli trougao | MAT-5.9.2 (geometry problems) |
| Perfekt Hilfsverb haben sein | DEU-4.2.9 |
| Ko je napisao Hasanaginicu | BHS-KNJ.33 |
| Da li smijem koristiti kalkulator? | tie of three at one matched word (exam.forbidden_aids among them); synonyms need embeddings |

Live verification (database): the Director built the index (1 `retrieval.index_built`, 514 chunks) and searched (1 audited
retrieval, query stored as hash, 8 sources returned; screen print received). The general question "Šta učenik treba znati o
ispitu" returned weak matches (expected for word search; semantic search needs the Gemini key) and exposed footnote text
in six trusted questions (AMB-19). Director decisions taken on the way: PDL-018 (teacher grading, answer visibility,
notifications, rewards follow the grade).

## DONE_CHECKLIST (Commander 1.6.1) — 2026-09-27

Evidence: typecheck ✔ · lint ✔ · `check:text` ✔ · Vitest 68/68 · `npm run test:db` ✔ (retrieval section) · build ✔ ·
Playwright 56/56 · security advisor: only the known Auth WARN · performance advisor: INFO only (unused indexes on new
tables) · live: 514 chunks, 1 index build and 1 search by the Director (audit rows).

| Area | Item | Result |
|---|---|---|
| Code quality | tsc zero errors; no `any` / `@ts-ignore` / `as unknown as` / `console.log` / TODO in new code | PASS |
| | No hard-coded values (result count, query bounds, relevance floor, path are constants) | PASS |
| | Browser console on the new screen | PASS (fixture render at 1440 and 390 px: no errors; the Director used it live) |
| Architecture | Queries only in repositories; permissions in `lib/permissions.ts`; domain (grounding) framework-free | PASS |
| | AI through a provider interface | PASS (`CanonRetriever`; no AI call yet, PDL-017) |
| | Feature folder `features/retrieval` per A-2 | PASS |
| | Multi-layer schema (chunk shape: DB function, repository, grounding, screen) enumerated; round trip verified live (build, search, audit row) | PASS |
| Security | Server Actions: authenticate, authorise (subject pre-check), Zod; database re-checks scope, filters active versions before ranking | PASS |
| | RLS on 2 new tables; chunks only for publishers and reviewers of the subject; retrieval log only with audit.view; students and anon nothing | PASS (DB tests) |
| | Injection: query reduced to letter/digit tokens; source blocks cannot be closed from inside (tests) | PASS |
| | Queries stored only as SHA-256; answer keys never indexed | PASS |
| | Live adversarial pass | PASS (grants verified: new functions service_role only; forged cookie e2e) |
| Error handling | try/catch; failed searches and builds audited; machine codes localised | PASS |
| UX | Loading states, fixed refusal, empty index state, errors in bs/de/en; mobile 390 px; labels and live regions | PASS |
| | Performance claims | none made |
| Documentation | JSDoc on exports, routes and actions; schema-audit 009 to 011; CHANGELOG; PDL-017, PDL-018; AMB-19; constants | PASS |
| | `.env.example` | N/A (no new variable) |
| Build/deploy | Build green; no new dependency | PASS |
| | Test data | PASS (live checks ran in rolled-back transactions; the index and the search are the Director's real actions) |
| | Rate limit N / N+1 | N/A (staff-only search; per-student limits come with student access, Sprint 06) |
| Post-deploy | Production URL | N/A (not deployed; Director: later) |
| Learning | `corrections/SPRINT_05_LESSONS.md` | PASS |

COMMANDER COMPLIANCE — Sprint 05
──────────────────────────────────
Rules followed without reminder:        27/29 (M-2, M-3, M-4, M-5, M-7, M-9, M-10, M-13, M-14, M-15, M-18, M-23, E-1, E-2, E-3, E-4, E-5, E-6, E-9, E-10, E-11, E-13, E-14, A-2, A-3, A-4, A-5)
Rules violated, caught by ACA:          2 (E-10: retrieval judged on fixture single-word tests first, live check showed the AND query failed, fixed by 010 and 011; E-11: a build piped into `head` was cut short, found by the e2e start failure)
Rules violated, caught by Director:     0 (the footnote defect AMB-19 is a data finding from the bulk acceptance, not a rule violation)
Rules that slowed work or felt wrong:   none
New rules suggested by this sprint:     see corrections/SPRINT_05_LESSONS.md (Commander Improvement Candidates, 1)

HANDOFF NOTE — Sprint 05
Completed: retrieval over trusted canon without an external AI service (PDL-017): chunks of 494 trusted questions and 20 confirmed rules, audited `retrieve_canon` that scopes to active versions and the actor's subjects before ranking, diacritic folding, OR query with prefixes, ranking by matched content words (migrations 009 to 011); `CanonRetriever` interface; grounded context with cited, delimited sources and fixed refusal; `/app/pretraga` with index build; used live by the Director. Decisions PDL-018 (teacher grades mock exams, answers after grading or after a practice answer, notifications, rewards follow the grade).
Not completed: semantic search (needs the Gemini key, Director: later); student access to search (Sprint 06 with the tutor rules).
Open risks: word search misses synonyms and general questions; six trusted questions carry footnote text (AMB-19) and must be corrected before students see them; 492 bulk-accepted questions not individually reviewed (PDL-016).
Technical debt: shadcn/ui deviation (PDL-010); Sentry deferred; leaked-password protection still off in Supabase Auth; Vercel deployment postponed by the Director.
Lessons captured: 6 entries in corrections/SPRINT_05_LESSONS.md.
Next sprint: Sprint 06 — Student Game Hub & practice: text revisions for AMB-19 first, then the student home (Game Hub), subject pages, practice loop over trusted questions with the answer shown only after the student's answer (PDL-018), closed items checked by key, open items recorded for the teacher, mastery per area, missions v1.

