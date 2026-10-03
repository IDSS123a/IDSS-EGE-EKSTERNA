import { z } from "zod";
import { PRACTICE_RESPONSE_MAX_LENGTH, RETRIEVAL_QUERY_MAX_LENGTH, RETRIEVAL_QUERY_MIN_LENGTH, REVIEW_TEXT_MAX_LENGTH } from "@/constants";

/**
 * Shared Zod schemas (Commander E-2: every boundary validated, schemas in one place).
 */

/** Staff log in with their official e-mail; students with a school-issued username (AMB-06, PDL-003). */
export const USERNAME_PATTERN = /^(?:[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[a-z0-9][a-z0-9._-]{2,59})$/;

/** POST login form. Password length is only bounded, never described, to avoid hinting policy. */
export const LoginSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(120)
    .regex(USERNAME_PATTERN),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/** Roles that may be created through the UI; the Superadministrator is designated, not created (§7A.1). */
export const CREATABLE_ROLES = ["administrator", "student"] as const;
/** Lifecycle states a manager may set (mandate §7A.4). `invited` is only the initial state. */
export const SETTABLE_STATUSES = ["active", "suspended", "blocked", "deactivated", "archived"] as const;
/** Unscoped staff bundles; subject_teacher is granted per subject (SUBJECT_BUNDLE, migration 008). */
export const GRANTABLE_BUNDLES = ["pedagogue", "psychologist", "admin_operations"] as const;
/** The bundle that is always scoped to exactly one exam subject (AMB-16). */
export const SUBJECT_BUNDLE = "subject_teacher";

const passwordSchema = (minLength: number) => z.string().min(minLength).max(200);

/** POST create account. Staff (administrator) username must be an e-mail; students must not use one (AMB-06). */
export function createAccountSchema(minPasswordLength: number) {
  return z
    .object({
      username: z.string().trim().toLowerCase().min(3).max(120).regex(USERNAME_PATTERN),
      displayName: z.string().trim().min(1).max(160),
      role: z.enum(CREATABLE_ROLES),
      password: passwordSchema(minPasswordLength),
    })
    .refine((value) => (value.role === "administrator") === value.username.includes("@"), {
      path: ["username"],
      message: "USERNAME_ROLE_MISMATCH",
    });
}

/** POST change account status. */
export const ChangeStatusSchema = z.object({
  userId: z.uuid(),
  status: z.enum(SETTABLE_STATUSES),
});

/** POST grant or revoke a bundle. */
export const BundleChangeSchema = z
  .object({
    userId: z.uuid(),
    bundle: z.enum([...GRANTABLE_BUNDLES, SUBJECT_BUNDLE]),
    subjectId: z.uuid().optional(),
    grant: z.enum(["grant", "revoke"]),
  })
  // A subject-teacher grant always names its subject; other bundles never do.
  .refine((value) => (value.bundle === SUBJECT_BUNDLE) === (value.subjectId !== undefined));

/** POST change own password: current password, new password (role minimum) typed twice, different from the current one. */
export function changeOwnPasswordSchema(minPasswordLength: number) {
  return z
    .object({ currentPassword: z.string().min(1).max(200), newPassword: passwordSchema(minPasswordLength), confirmPassword: z.string() })
    .refine((value) => value.newPassword === value.confirmPassword, { message: "MISMATCH" })
    .refine((value) => value.newPassword !== value.currentPassword, { message: "UNCHANGED" });
}

/** POST reset password. */
export function resetPasswordSchema(minPasswordLength: number) {
  return z.object({ userId: z.uuid(), password: passwordSchema(minPasswordLength) });
}

// ------------------------------------------------------------------ canon registry (Sprint 02)

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => (value ? value : null));
const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.iso.date().nullable());

/** POST prepare a direct upload: only the declared size is needed to issue the ticket. */
export const CanonUploadRequestSchema = z.object({
  byteSize: z.number().int().positive(),
});

/**
 * POST register an uploaded file as a new canonical version. Either `documentId` (new version of
 * an existing document) or `typeCode` + `documentTitle` (new document) must be given.
 */
export const CanonRegisterSchema = z
  .object({
    uploadId: z.uuid(),
    documentId: z.union([z.uuid(), z.literal("")]).optional().transform((value) => (value ? value : null)),
    typeCode: z.string().trim().regex(/^[a-z_]+$/).optional().or(z.literal("")),
    documentTitle: optionalText(200),
    subjectLabel: optionalText(80),
    issuingAuthority: z.string().trim().min(1).max(200),
    officialTitle: z.string().trim().min(1).max(300),
    referenceNumber: optionalText(100),
    publishedOn: optionalDate,
    effectiveFrom: optionalDate,
    revisionLabel: optionalText(60),
  })
  .refine((value) => value.documentId !== null || (Boolean(value.typeCode) && value.documentTitle !== null), {
    message: "DOCUMENT_REQUIRED",
  });
export type CanonRegisterInput = z.infer<typeof CanonRegisterSchema>;

/** POST lifecycle change of one version. Reason length matches the database check (1..500). */
export const CanonTransitionSchema = z.object({
  versionId: z.uuid(),
  action: z.enum(["activate", "rollback", "reject", "archive"]),
  reason: z.string().trim().max(500).optional().transform((value) => (value ? value : null)),
});

/** POST run the catalogue extraction for one document version (Sprint 03). */
export const IngestionRunSchema = z.object({ versionId: z.uuid() });

const share = z.coerce.number().min(0).max(100);
/** POST splash palette: four shares in percent that add up to 100 (PDL-020). */
export const SplashPaletteSchema = z
  .object({ red: share, yellow: share, blue: share, sky: share })
  .refine((value) => Math.abs(value.red + value.yellow + value.blue + value.sky - 100) < 0.1);

/** POST search over trusted canon (Sprint 05). */
export const CanonSearchSchema = z.object({
  query: z.string().trim().min(RETRIEVAL_QUERY_MIN_LENGTH).max(RETRIEVAL_QUERY_MAX_LENGTH),
  subjectId: z.preprocess((value) => (value === "" ? undefined : value), z.uuid().optional()),
});

/** POST load canonical facts of one catalogue version (Sprint 04). */
export const FactsLoadSchema = z.object({ versionId: z.uuid() });

const reviewText = z.string().trim().min(1).max(REVIEW_TEXT_MAX_LENGTH);
const optionalReviewText = z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? undefined : value), reviewText.optional());

/** POST confirm or dispute a canonical rule; a dispute needs a note. */
export const RuleReviewSchema = z
  .object({ ruleId: z.uuid(), subjectId: z.uuid(), decision: z.enum(["confirmed", "disputed"]), note: optionalReviewText })
  .refine((value) => value.decision === "confirmed" || value.note !== undefined);

/** Task types a reviewer may confirm (the extractor vocabulary, AMB-10). */
export const REVIEW_TASK_TYPES = [
  "multiple_choice_single_answer",
  "matching",
  "completion",
  "short_constructed_response",
  "open_constructed_response_stepwise",
  "open_extended_response",
  "true_false",
  "completion_from_word_bank",
] as const;

/** POST accept (with confirmed task type) or return (with reason) an ingested record. */
export const RecordDecisionSchema = z
  .object({
    recordId: z.coerce.number().int().positive(),
    decision: z.enum(["accepted", "returned"]),
    taskType: z.preprocess((value) => (value === "" ? undefined : value), z.enum(REVIEW_TASK_TYPES).optional()),
    reason: optionalReviewText,
  })
  .refine((value) => (value.decision === "accepted" ? value.taskType !== undefined : value.reason !== undefined));

/**
 * POST a catalogue erratum (P-15, migration 020): the printed task and key stay as printed; the erratum is a notice
 * to students and teachers. itemNumber names the German statement it concerns, empty for the whole task.
 */
export const ErratumSchema = z.object({
  questionVersionId: z.uuid(),
  subjectId: z.uuid(),
  itemNumber: z.preprocess((value) => (value === "" || value === null ? undefined : value), z.coerce.number().int().positive().optional()),
  description: reviewText,
  evidence: reviewText,
});

/** POST withdraw an erratum (a new row that cancels it; nothing is deleted). */
export const ErratumWithdrawalSchema = z.object({ erratumId: z.uuid(), subjectId: z.uuid(), reason: reviewText });

/** POST a follow-up (provisional acceptance: a named person must still check the question). */
export const FollowUpSchema = z.object({
  questionVersionId: z.uuid(),
  subjectId: z.uuid(),
  assignee: z.string().trim().min(1).max(200),
  note: reviewText,
});

/** POST resolve a follow-up with a note. */
export const FollowUpResolutionSchema = z.object({ followUpId: z.uuid(), subjectId: z.uuid(), note: reviewText });

/** POST a practice answer (migration 017): one response per item of the question; the database checks the items. */
export const PracticeAnswerSchema = z.object({
  questionVersionId: z.uuid(),
  subjectId: z.uuid(),
  responses: z
    .array(z.object({ item: z.number().int().positive().nullable(), response: z.string().max(PRACTICE_RESPONSE_MAX_LENGTH) }))
    .min(1)
    .max(20),
});

/** Answers of a mock exam while writing or on submission (migration 019): at most 60 units of 4000 characters. */
export const ExamResponsesSchema = z.object({
  examId: z.uuid(),
  responses: z.array(z.object({ id: z.uuid(), response: z.string().max(PRACTICE_RESPONSE_MAX_LENGTH) })).max(60),
});

/** POST a reviewer's decision on a mock exam blueprint: a rejection needs a note (migration 019). */
export const BlueprintReviewSchema = z
  .object({ blueprintId: z.uuid(), subjectId: z.uuid(), decision: z.enum(["confirmed", "rejected"]), note: optionalReviewText })
  .refine((value) => value.decision === "confirmed" || value.note !== undefined);

/** POST discard a mock exam set with a reason, optionally composing a new set (migration 022). */
export const SetDiscardSchema = z.object({ examId: z.uuid(), subjectId: z.uuid(), note: reviewText, newSet: z.boolean() });

/** POST teacher grades: points the unit allows, or correct pairs for matching units; the database checks both. */
export const GradesSchema = z.object({
  examId: z.uuid(),
  subjectId: z.uuid(),
  scores: z
    .array(
      z.union([
        z.object({ id: z.uuid(), points: z.number().min(0).max(10), note: z.string().trim().max(REVIEW_TEXT_MAX_LENGTH).nullable() }),
        z.object({ id: z.uuid(), pairs: z.number().int().min(0).max(20), note: z.string().trim().max(REVIEW_TEXT_MAX_LENGTH).nullable() }),
      ]),
    )
    .min(1)
    .max(60),
});

/** POST a teacher's verdict on a practice answer waiting for the teacher (migration 021). */
export const PracticeVerdictSchema = z.object({
  answerId: z.uuid(),
  verdict: z.enum(["correct", "partly_correct", "incorrect"]),
  note: optionalReviewText,
});

/** POST a support note (migration 026): neutral type (D3), visibility (D1), optional follow-up date. */
export const TeacherNoteSchema = z.object({
  personId: z.uuid(),
  subject: z.enum(["bhs_language_literature", "mathematics", "german"]),
  body: z.string().trim().min(1).max(4000),
});

export const SupportNoteSchema = z.object({
  personId: z.uuid(),
  kind: z.preprocess((value) => (value === "" ? null : value), z.enum(["student_talk", "parent_talk", "agreement", "observation"]).nullable()),
  body: z.string().trim().min(1).max(4000),
  followUpOn: z.preprocess((value) => (value === "" ? null : value), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
  visibility: z.enum(["author", "support"]),
});
