# Phased Implementation Plan — IDSS EGE

Status: proposed (Sprint 00) · Each sprint leaves the app testable (mandate §20, M-13).
Order follows mandate §20; canon foundations come before any student AI feature (§27).

| Sprint | Scope (IN) | Exit criteria |
|---|---|---|
| **00 — Discovery** ✅ | Commander bootstrap docs, repository audit, evidence map, prototype audit, catalogue ingestion evidence (200/200/200), architecture, data model, roles, ambiguities | this document set committed; Director answers AMB-01…03 |
| **01 — Foundation** | Next.js scaffold, design tokens, splash screen, Supabase project + migrations for identity/cohorts/canon registry, username+password auth, capability model + RLS, account lifecycle UI (Superadmin), audit log, security headers, rate limiting | see `sprints/SPRINT_01.md` |
| 02 — Canon registry | Superadmin upload (magic bytes, SHA-256, private storage), metadata form, version lifecycle, `activate_canon_version()`, history & rollback view, dependency map | upload → activate → supersede → rollback demonstrated; nothing deleted |
| 03 — Ingestion pipeline | TypeScript extractor + parser profiles; reproduces Sprint-00 outputs (regression); ingestion report per job; OCR fallback decision | 200/200/200 units with identical IDs and keys to the golden reference |
| 04 — Review & knowledge | Review queue UI (rendered page region beside the record), LaTeX normalisation for math, answer-key revisions, canonical rules with page quotes, subject/area rows | subject teachers review; first trusted questions |
| 05 — Retrieval (RAG) | chunking of trusted records, embeddings, `retrieve_canon()` with active-version filter, retrieval audit, provider interface, refusal behaviour, injection tests | superseded content never retrieved (test) |
| 06 — Student Game Hub & practice | Game Hub, subject pages, practice loop with feedback, mastery model, missions v1 | a student can practise every trusted question |
| 07 — Exam engine | mock-exam blueprints from canonical rules (+ AMB-09/10 data), timer, attempts history; pre-scoring of closed items, teacher grading queue and grade confirmation, notification per submitted exam (PDL-018) | Math/B/H/S/German mock exams match canon structure; results visible only after the teacher's confirmation |
| 08 — Gamification | event stream, XP, levels, streaks, badges, celebrations (reduced-motion aware); rewards on the teacher's confirmed grade plus effort and regularity (PDL-018) | XP never affects scoring (test) |
| 09 — Staff Command Center | per-student and class progress, weak areas, inactivity signals, daily summary notification (PDL-018), assignments, teacher notes, support notes (separate RLS) | privacy boundaries verified live |
| 10 — Director Command Center | aggregate analytics, content health, audit, configuration | aggregate-first views |
| 11 — Hardening & launch | accessibility audit, security adversarial pass (forged token, self-escalation, cross-role reads), performance (E-15), production deploy | DONE checklist incl. post-deploy verification |

AI tutor/explanations arrive only after Sprint 05 and only on trusted, active content.
