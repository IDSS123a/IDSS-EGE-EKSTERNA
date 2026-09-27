# IDSS EGE — Conceptual Data Model

Status: proposed (Sprint 00) · Implemented incrementally by numbered migrations (A-6).
Every table: RLS on, deny by default. Tables marked **(S1)** are built in Sprint 01.
Each entity below is justified by evidence (mandate section or source); entities from
the mandate's §15 list that are not justified yet are listed at the end as deferred.

## 1. Identity, roles, cohorts (mandate §7A.1–7A.4)

| Table | Purpose | Key columns |
|---|---|---|
| `profiles` (S1) | one row per auth user | `user_id` (= auth.users.id), `username` unique, `display_name`, `account_status` (`invited, active, suspended, blocked, deactivated, archived`), `role` (`superadmin, administrator, student`) |
| `capabilities` (S1) | catalogue of fine-grained permissions | `code` (e.g. `canon.publish`, `students.view_progress`, `support_notes.read`) |
| `role_capabilities` / `profile_capabilities` (S1) | grants; scoped grants carry `subject_id` | `scope_subject_id` nullable |
| `persons` (S1) | longitudinal student identity (survives school years) | `id`, `profile_id` nullable (account may be archived while history stays) |
| `school_years` (S1) | e.g. 2026/27 | `label`, `starts_on`, `ends_on`, `status` |
| `cohorts` (S1) | generation (e.g. "IX 2026/27") | `school_year_id`, `label` |
| `enrolments` (S1) | person ↔ school year ↔ cohort/class | `person_id`, `cohort_id`, `class_label`, `status`, `first_foreign_language_subject_id` (AMB-03) |
| `subject_participations` | person × subject within an enrolment | `enrolment_id`, `subject_id`, `exempt_reason` nullable (C11) |

## 2. Canon registry & versioning (mandate §0, §4)

| Table | Purpose | Key columns |
|---|---|---|
| `canonical_document_types` (S1) | catalogue, rulebook, instruction, official form, exam test, answer key… | `code`, `authority_level` (1–6), `capabilities` jsonb, `parser_profile_id` |
| `canonical_documents` (S1) | logical document within a scope | `type_id`, `scope_subject_id` nullable, `scope` jsonb, `title` |
| `canonical_document_versions` (S1) | immutable uploaded source + metadata | `document_id`, `storage_path`, `sha256` unique, `mime`, `bytes`, `issuing_authority`, `official_title`, `reference_number`, `published_on`, `effective_from`, `revision_label`, `status` (`draft…archived`), `uploaded_by`, `activated_by`, `activated_at`, `superseded_by_version_id`; partial unique index: one `active` per `document_id` |
| `canon_generation` (S1) | single-row counter bumped on every activation | used in cache keys |
| `canonical_dependencies` | derived object ↔ source version | `source_version_id`, `dependent_table`, `dependent_id`, `state` (`current, stale, rebuilt`) |
| `parser_profiles` | versioned parser configuration (data) | `document_type_id`, `version`, `config` jsonb |

## 3. Ingestion & validation (mandate §0 Quality Gate)

| Table | Purpose |
|---|---|
| `canonical_ingestion_jobs` | per version: state, extractor version, page counts, counts detected / structured / flagged / failed |
| `canonical_validation_results` | per record per gate (`structural`, `semantic_source`): status, issues, reviewer, timestamp |
| `review_queue_items` | work items for reviewers (flagged records, disputed keys, AI outputs to approve) |

## 4. Canonical knowledge (mandate §10, §14)

| Table | Purpose | Key columns |
|---|---|---|
| `subjects` | the three exam subjects, **rows derived from the active rulebook** (C1 Art. 5) | `code`, `official_name`, `source_version_id` |
| `subject_areas` | catalogue areas (e.g. "5.4 Morfologija", "Hörverstehen") | `subject_id`, `source_version_id`, `source_label`, `ordinal` |
| `questions` | stable identity of a catalogue question across versions | `stable_key` (e.g. `MAT-5.4.12`), `subject_id` |
| `question_versions` | the question as published in one document version | `question_id`, `document_version_id`, `original_number`, `record_kind`, `raw_text`, `normalized_text` (e.g. reviewed LaTeX), `stem_text`, `emphasis_spans` jsonb, `source_regions` jsonb (page+bbox), `task_type`, `catalogue_level` nullable, `area_id`, `trust_status` |
| `question_options` | a)–d) options per question version | `question_version_id`, `label`, `text` |
| `scored_items` | scored units inside a task (German 4 per task) | `question_version_id`, `item_number`, `raw_text` |
| `answer_keys` | key as printed in the source | `question_version_id` / `scored_item_id`, `raw_answer`, `source_page` |
| `answer_key_revisions` | reviewed corrections (CF-03) — never overwrite the printed key | `answer_key_id`, `corrected_answer`, `reason`, `evidence`, `reviewed_by` |
| `stimuli` | shared passages, transcripts, figures | `kind`, `raw_text`, `source_regions`, `audio_asset_id` nullable |
| `canonical_rules` | rule facts with provenance (duration, points, composition, allowed aids) | `subject_id`, `rule_code`, `value` jsonb, `source_version_id`, `source_page`, `quote` |
| `competencies` | outcome statements quoted from catalogue §1 | `subject_id`, `source_version_id`, `quote` |
| `question_competencies` | reviewed mapping only | `question_version_id`, `competency_id`, `reviewed_by` |

## 5. RAG

| Table | Purpose |
|---|---|
| `canonical_chunks` | text chunks of trusted records/rules with `document_version_id`, subject, page, section |
| `canonical_embeddings` | `chunk_id`, `embedding vector(768)`, `model` |
| `retrieval_audit_logs` | query hash, filters, returned chunk ids, requesting user, timestamp |
| `derived_practice_items` | AI/teacher-derived items, `origin`, linked `source_question_version_ids`, `approval_status` |

## 6. Learning, exams, gamification (mandate §8–10)

`practice_sessions`, `practice_answers` (per scored item), `mock_exam_blueprints`
(from `canonical_rules` + reviewed IDSS blueprint data), `mock_exam_attempts`,
`mastery_snapshots` (person × area, dimensions: completion, accuracy, mastery,
consistency, exam performance), `missions`, `mission_progress`,
`gamification_events` (append-only), `xp_ledger`, `badges`, `person_badges`, `streaks`.
Attempts, mastery and events reference `person_id` (not `profile_id`) so history
survives account archival and cohort changes.

## 7. Staff support & communication (mandate §11–13)

`assignments`, `announcements`, `notifications`, `teacher_notes` (academic, visible to
subject staff), `support_notes` (pedagogue/psychologist only, separate RLS, never in
exports or audit previews — M-15).

## 8. Platform

`audit_logs` (append-only; actor, action, entity, before/after hashes, ip, ts),
`security_events` (failed logins, lockouts, permission denials), `system_settings`,
`splash_messages` (seeded from mandate §7A.8, editable by Superadmin).

## 9. Deferred (not justified yet)

`classes` / `class_members` as separate tables (a class label on `enrolments` suffices until
teachers need class-level assignments), `levels` (derived from XP thresholds stored in
`system_settings`), exam-administration entities from the prototype (AMB-05).

## 10. Foreign-key rules

- Audit/history references use `ON DELETE NO ACTION` (A-10); deletion of an account is
  preceded by a blocker check and offered as deactivation instead.
- Derived content never cascades from its canonical parent (A-10); staleness is tracked
  in `canonical_dependencies`.
