import type { SubjectCode } from "@/features/knowledge/types";

/** In-app notification kinds (migration 019): a teacher per submitted mock exam, a student per released result. */
export type NotificationKind = "mock_exam_submitted" | "mock_exam_graded";

export type AppNotification = { id: string; kind: NotificationKind; examId: string | null; subjectCode: SubjectCode | null; createdAt: string; read: boolean };
