# Prototype Audit — `CODE-PROTOTYPE/`

Status: Sprint 00 · Date: 2026-09-27 · Authority level 6 (implementation ideas only)

The prototype is kept in the repository unchanged. Nothing is deleted in this sprint
(INSTRUCTION §5.3, M-4 emergency brake). This document decides what is reused,
adapted or replaced, and why.

## 1. What it is

- **Stack:** Vite 8 + React 19 SPA, Express 4 server run with `tsx` (`server.ts`,
  1,400+ lines, ~45 routes), Tailwind 4, `motion`, `d3`, `lucide-react`, `@google/genai`.
  `package.json` name is `react-example`; `metadata.json` marks it as an AI-Studio
  scaffold ("Eksterna Matura – Informacioni Sistem").
- **Persistence:** none. `src/server/db.ts` is an in-memory store seeded from
  `src/server/mockData.ts` (61 KB); every restart resets all data.
  `src/db/schema.sql` is a PostgreSQL design that is **not connected** to the code.
- **Roles:** `student | admin | superadmin` (single undifferentiated admin role).
- **i18n:** custom context (`src/i18n/index.tsx`) with `bs`, `de`, `en` dictionaries;
  language remembered in `localStorage`.
- **Build status:** not executed in Sprint 00 (dependencies not installed); no tests exist.

## 2. Functional inventory

| Area | Component / route | Behaviour | Verdict |
|---|---|---|---|
| Student dashboard | `student/StudentDashboard.tsx` | stats, next steps, subject cards | **Adapt** (idea for the Game Hub layout) |
| Practice | `student/QuestionPractice.tsx`, `POST /api/student/practice-activity` | one-by-one MC practice with feedback | **Adapt** interaction pattern; content must come from canon records |
| Exam simulator | `student/ExamSimulator.tsx`, `GET /api/exams/generate-simulation/:subjectId` | timed mock test | **Replace** logic: timing/points must resolve from canonical rules (60 min / 10 pts), not from prototype subject objects |
| Analytics | `student/StudentAnalytics.tsx`, `SubjectMasteryD3Chart.tsx` (d3) | mastery chart per topic | **Adapt** visual idea; progress model must follow INSTRUCTION §9 (multi-dimensional) |
| Badges | `student/StudentBadges.tsx`, `BadgeCelebrationModal.tsx` | badges + celebration animation | **Adapt** (celebration motion is good); badge rules become data-driven gamification events |
| AI tutor | `student/AITutor.tsx`, `POST /api/student/ai-tutor/chat` | Gemini chat | **Replace**: must become canon-grounded RAG with version filters and provenance |
| Chatbot | `GeminiChatbot.tsx`, `POST /api/gemini/chat`, `server/knowledgeBase.ts` | keyword "RAG" over a hard-coded corpus with refusal on low score | **Keep the idea** (refusal when evidence is insufficient); **replace the corpus** (fabricated, see §4) |
| Candidate rules | `student/CandidateRules.tsx` | shows exam-day rules | **Adapt**; text must come from the active canon (C12–C14 §3/§4, C5) |
| Question bank admin | `admin/QuestionBankManager.tsx`, `/api/questions*`, `/api/categories`, `/api/tags` | CRUD, categories, tags | **Adapt** as review UI for canonical records (review queue, provenance display) — canonical text must not be editable in place |
| Exam configurator | `admin/ExamConfigurator.tsx`, `/api/exams*`, `draw-pool` | exam sessions, commission, pool drawing | **Out of Sprint 1 scope**; exam *administration* is not part of the student-preparation mandate unless the Director confirms (AMB-05) |
| Student monitoring | `admin/StudentMonitoring.tsx`, `/api/admin/overview` | class overview | **Adapt** into Teacher Command Center (INSTRUCTION §12) |
| Accommodations | `admin/AccommodationsManager.tsx`, `/api/admin/accommodations` | extra time, large font, assistant… | **Adapt** only with canon mapping (C6, C7) and privacy controls (support data is sensitive) |
| Document generator | `admin/DocumentGenerator.tsx`, `OfficialDocumentView.tsx`, `/api/documents/generate` | generates "official" documents | **Hold**: no document may be presented as an official form until mapped to a canonical template (EM1–EM11) and verified (INSTRUCTION §24) |
| Executive dashboard | `superadmin/ExecutiveDashboard.tsx` | KPIs | **Adapt** as Director Command Center (aggregate-first) |
| Compliance matrix | `superadmin/ComplianceMatrix.tsx`, `/api/compliance*` | regulation checklist | **Replace** content (seeded from fabricated regulations) |
| Audit log | `superadmin/AuditLogViewer.tsx`, `/api/audit-logs` | log viewer | **Adapt**; audit must be append-only and server-written |
| School settings | `superadmin/SchoolSettingsManager.tsx` | settings | **Adapt** |
| Architecture modal | `StackArchitectureModal.tsx` | marketing/tech modal | **Drop** (not product functionality) |
| Auth modal | `AuthModal.tsx`, `/api/auth/*` | login/register | **Replace** (see §3) |

## 3. Security findings (all 🔴 — prototype must never be deployed with real data)

1. **No password verification.** `POST /api/auth/login` accepts any password for an existing e-mail.
2. **Forgeable identity.** The "token" is the literal string `jwt-token-<userId>`; the server trusts an `x-user-id` header.
3. **Fail-open to Superadmin.** `getAuthUser()` falls back to `db.users[0]`, which is `direktor@idss.ba` — an unauthenticated request acts as the Superadmin.
4. **Open self-registration with role choice.** `POST /api/auth/register` lets the caller pick `role` (including `superadmin`).
5. **No authorization on admin routes** (`/api/users`, role/status changes, question CRUD, audit logs, settings).
6. **No input validation** (no Zod or equivalent); no rate limiting; no security headers.
7. Gemini key read from `VITE_GEMINI_API_KEY` as a fallback — a `VITE_` variable is bundled to the client if referenced in frontend code (E-4, DONE checklist).

## 4. Content findings (conflict with the canon)

- `mockData.ts` defines **five** subjects (adds *Engleski jezik*, *Fizika*), each with 90 min / 100 points / 50 % threshold — contradicts C1 Art. 5 and C12–C14 (60 min / 10 points / no threshold). → CF-01.
- `knowledgeBase.ts` cites documents and articles that are not in the repository (IDSS "Ustav", "Zakon … Član 88/89", "Pravilnik … 2025 Član 10–19", a Physics catalogue, "DSD I" accreditation). Treated as **fabricated**; never imported. → CF-02.
- The 20 mock questions are not catalogue questions (e.g. cylinder volume, 15 % discount) and carry no source. Not imported.
- Mock users use invented e-mails (`matematika@idss.ba`, `deutsch@idss.ba`, `*@ucenik.idss.ba`) that differ from the official user model (INSTRUCTION §7A.1).

## 5. Reusable assets and patterns

- Official logo file `public/logo_white.png` (331×101 RGBA; three identical copies) — reuse after verification (AMB-07). The five `*_1790….jpg` crests/heros are not the official mark and are not reused as a logo.
- IDSS palette usage and card/gradient visual language in `index.css` + components — reference for the design-token system.
- `motion` celebration patterns (badge modal) — reference for reward feedback.
- i18n dictionary approach (Bosnian primary) — replace with a maintained i18n layer but reuse translated strings where they are not canon-dependent.
- `schema.sql` — useful checklist of admin entities (schools, sessions, commissions, accommodations); not reused as-is because it lacks canon versioning, provenance and longitudinal student identity.

## 6. Decision

Build the target application fresh (INSTRUCTION "FROM SCRATCH", Commander default stack —
see `DECISION_LOG.md` PDL-001) and port the UX patterns listed above feature by feature.
Each ported behaviour gets a regression note in the sprint document that ports it.
The prototype folder stays in the repository as reference until the Director approves
its archival.
