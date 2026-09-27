# SPRINT 05 — Retrieval over trusted canon (RAG foundation, no external AI yet)

Status: **in progress** · Started 2026-09-27 ("kreni sa Sprint 05", Director)
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

Live step for the Director: open "Pretraga službenih materijala" and press "Izgradi indeks" once.
