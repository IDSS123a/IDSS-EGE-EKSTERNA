import type { SubjectCode } from "@/features/knowledge/types";

/** In-app notification kinds (migrations 019, 024, 029, 032, 036): teachers per requested set and submitted exam, a student per released result, assignment, gift and test a teacher sent. */
export type NotificationKind = "mock_exam_requested" | "mock_exam_submitted" | "mock_exam_graded" | "assignment_given" | "gift_given" | "mock_exam_assigned";

export type AppNotification = { id: string; kind: NotificationKind; examId: string | null; subjectCode: SubjectCode | null; createdAt: string; read: boolean };
