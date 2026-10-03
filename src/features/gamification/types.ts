import type { SubjectCode } from "@/features/knowledge/types";

/** XP by source (PDL-029). XP motivates practice; it is never a grade and never changes a score (P-7). */
export type XpBreakdown = { answers: number; missions: number; practiceDays: number; examsSubmitted: number; examsGraded: number };

/** Badges of a student (PDL-029): earned or not, per subject where the badge belongs to a subject. */
export type Badges = { firstAnswer: boolean; streak: boolean; answersInSubject: SubjectCode[]; firstMockExam: SubjectCode[]; allSubjects: boolean };

export type GamificationOverview = { xp: XpBreakdown; badges: Badges };
