# IDSS EGE — Target Architecture

Status: proposed (Sprint 00) · Date: 2026-09-27 · Governs: Sprint 01+
Inputs: `INSTRUCTION-WEB-APP-IDSS-EGE.html` (mandate), Commander v1.6.1 (project upgraded to v1.6.2 on 2026-10-03, PDL-028),
`docs/discovery/*`. Data model: `DATA_MODEL.md`. Roles: `ROLES_AND_PERMISSIONS.md`.

## 1. Principle: code is the engine, the canon is the content

Everything that an official publication can change — subjects' official names,
test duration, points, test composition, question text, answer keys, allowed
aids, official forms — lives in the database as rows **derived from a specific
canonical document version**, never in components, constants or static JSON.
Code only knows *document types* and *capabilities* (e.g. "a subject catalogue
has questions, solutions and a test blueprint").

Resolution rule: every read of canonical content goes through the **active
version** of the relevant document (`status = 'active'`), enforced in SQL views
and retrieval functions, not in UI code.

## 2. Stack (Commander default — PDL-001)

| Layer | Choice | Why |
|---|---|---|
| Web app | Next.js (App Router) + TypeScript strict + Tailwind + shadcn/ui | Commander DL-003/008/011; mandate §6 |
| Data | Supabase Postgres + Row Level Security + pgvector | DL-001; RLS gives database-level authorization (mandate §7A.5) |
| Auth | Supabase Auth, username + password (username mapped server-side, PDL-003) | provider-verified tokens (E-4); no plaintext passwords |
| Files | Supabase Storage, private bucket `canon-sources` (write-once objects keyed by SHA-256) | immutable originals (mandate §0) |
| AI | `lib/ai` provider interface; Gemini default (DL-005) — model strings verified at Sprint 5 start | swap without touching domain logic (A-5) |
| Hosting | Vercel | DL-003 |
| Monitoring | Sentry (DL-006) | E-8 |

The Sprint-00 evidence extractor (`tools/canon-ingestion/`, Python) is a
**developer tool and golden reference**, not part of the runtime (PDL-002).

## 3. Engines and where they live (feature folders, M-6 / A-2)

```
src/
  app/                        routes only (thin): (auth), (student), (staff), (admin), api/
  features/
    authentication/           login, session, account lifecycle
    splash/                   first-paint splash (logo + rotating messages)
    canon-registry/           document types, documents, versions, activation/supersession, dependency map
    canon-ingestion/          upload → extract → segment → validate → review queue → publish
    canon-knowledge/          subjects, areas, questions, answer keys, rules, provenance queries
    retrieval/                chunking, embeddings, filtered retrieval (RAG), retrieval audit
    learning/                 missions, learning paths, practice sessions, mastery
    exam-engine/              mock-exam blueprints (from canon rules), attempts, scoring
    gamification/             event log → XP, levels, streaks, badges (never touches scoring)
    student-hub/              Game Hub UI
    staff-command-center/     teacher / pedagogue / psychologist tools
    director-command-center/  aggregate analytics, configuration, audit
    users-and-cohorts/        persons, enrolments, school years, classes
    audit/                    append-only audit log
  lib/  ai/  db/  validation/schemas.ts  permissions.ts  i18n/
  constants/index.ts  types/index.ts
migrations/                   numbered SQL (A-6)
tools/canon-ingestion/        Sprint-00 evidence extractor (Python)
```

Layering (M-5): component → Server Action / route handler → domain → repository → Supabase.
Every Server Action: authenticate → authorise (`lib/permissions.ts`) → Zod → execute → standard response (E-6).

## 4. Canonical Admin & Versioning Engine

Lifecycle of a document version:

```
draft → processing → validation_required → active → superseded → archived
                  ↘ rejected
```

Publishing flow (Superadmin only, one server-side transaction):

1. Upload: size/extension/MIME **and magic-byte** check (E-4); SHA-256 computed;
   object written once to `canon-sources/<sha256>.<ext>`; duplicate hash → reuse, no second copy.
2. Metadata recorded: type, scope (subject/grade/exam), issuing authority, official
   title, publication/effective date, reference number, revision label, uploader.
3. Ingestion job created (§5). The version stays `validation_required` until the
   structural gate passes **and** a reviewer signs off the semantic gate.
4. Activation (`activate_canon_version(version_id)` SQL function, `SECURITY DEFINER`,
   callable only via the Superadmin action):
   - previous `active` version of the same document → `superseded` (never deleted);
   - new version → `active`; a partial unique index guarantees one active version per document;
   - `canon_generation` counter incremented → every cache key includes it (stale-cache invalidation);
   - dependent derived objects (practice items, chunks, embeddings, blueprints) of the
     old version are marked `stale` via `canonical_dependencies`; their regeneration jobs are queued;
   - audit rows written (who, when, what replaced what, validation summary).
5. Rollback = activating a previous version again (same function); history is kept.

Students never see a partially processed version: all student-facing views join
`canonical_document_versions.status = 'active'`.

## 5. Canonical Ingestion & Semantic Processing Engine

```
source file ─► text layer extraction (OCR fallback for image-only pages)
           ─► parser profile (per document type, versioned DATA: section / id / option /
              solution patterns, page ranges) ─► segments
           ─► syntax layer   exact text, options, emphasis spans, page+bbox regions
           ─► logic layer    task type, sub-parts, scored items, answer key (source only)
           ─► semantic layer area, catalogue level (only if source-defined), competency
                             mapping (review-only; never inferred silently)
           ─► structural gate (automatic)  ─► review queue ─► semantic/source gate (human)
           ─► trusted question versions ─► chunks + embeddings ─► index refresh
```

- **Parser profiles are data**, stored with the document type and versioned. A
  new catalogue with the same layout conventions is ingested without code changes;
  a layout the profile cannot segment lands in the review queue with a manual
  structuring UI (reviewer marks question boundaries on the rendered page) —
  still no deployment needed.
- The TypeScript pipeline must reproduce the Sprint-00 Python outputs on the
  three current catalogues (regression test: 200 / 200 / 200 units, identical IDs,
  identical answer keys).
- Answer-key corrections (CF-03) are separate `answer_key_revisions` rows with
  reviewer, reason and evidence; the original catalogue key stays visible.
- 2-D mathematics notation: the reviewer confirms/edits a LaTeX rendering stored
  as `normalized_text`; `raw_text` and the page region stay untouched.

## 6. Canonical Knowledge Engine + RAG (mandate §13A)

- Knowledge objects: subject, area, question (+ versions), answer key, explanation,
  canonical rule (e.g. "test duration = 60 min", with source page), derived practice item.
- Chunks are cut from **trusted** records and rules, carry `document_version_id`,
  subject, page/section, and are embedded (768-dim, pgvector).
- Retrieval is a SQL function `retrieve_canon(query_embedding, subject, k)` that
  **first** filters `version.status = 'active'` and scope, **then** orders by
  similarity; superseded content is reachable only through an explicit
  historical/audit function available to Superadmin.
- Generation receives only retrieved chunks + their provenance; answers cite
  document, version and page. Insufficient evidence → fixed refusal text + review ticket.
- AI outputs are stored as `derived_practice_items` / `explanations` with
  `origin = 'ai_derived'`, linked to source questions, and are never labelled "official".
- Every retrieval is logged (`retrieval_audit_logs`: query hash, filters, returned chunk ids).
- Prompt-injection hardening (A-5): system prompt fixed, persona locked, retrieved
  text treated as data; live attack tests before release.

## 7. Learning, exam and gamification engines

- **Exam engine** builds mock-exam blueprints from canonical rules (duration, points,
  composition) of the active catalogue version + IDSS-reviewed blueprint data
  (AMB-09/10). Scoring rules are data (e.g. B/H/S matching partial credit).
- **Mastery** is computed from attempts per area/question (accuracy, recency,
  consistency) and stored separately from XP (mandate §8.3, §9). "Readiness" is
  labelled an internal educational indicator.
- **Gamification** consumes an append-only event stream
  (`LESSON_STARTED … STREAK_EXTENDED`, mandate §8.4); XP/badges never feed scoring.

## 8. Security architecture (mandate §7A, E-4, DONE checklist)

- Supabase Auth session in HTTP-only, `SameSite=Strict`, `Secure` cookies; role resolved
  on every request from `profiles` by verified user id (never from JWT claims or headers).
- RLS enabled deny-by-default on every table; policies call `has_capability()`;
  service-role key only in background jobs (A-8).
- Rate limiting on login and upload (per IP + per username), uniform login error
  (no account enumeration), lockout with audit event.
- Security headers (CSP, HSTS, X-Frame-Options, Referrer-Policy) via Next.js middleware.
- Uploads: whitelist `pdf/docx/xlsx`, size cap, magic bytes, stored private.
- Support/psychological notes in a separate table with its own RLS; never joined
  into teacher views, exports or audit-log previews (M-15).
- Known limitation disclosed (E-4): blocking a user stops new logins immediately,
  but an issued access token remains valid until expiry (≤ 1 h).

## 9. First-paint splash (mandate §7A.8)

Rendered by the root layout as static HTML/CSS before hydration so it paints first;
official logo; message pool (≥ 12 messages) loaded from `splash_messages` (data,
editable by Superadmin), non-repeating shuffle; `prefers-reduced-motion` → static
fade-free variant; dismissed as soon as the session check resolves, with a minimum
display time named in `constants/index.ts`.
