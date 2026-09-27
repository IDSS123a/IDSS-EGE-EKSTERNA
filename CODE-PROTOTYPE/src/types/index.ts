/**
 * Eksterna Matura - Model podataka i tipovi
 * Podrška za uloge: Učenik (student), Nastavnik/Pedagog/Psiholog (admin), Direktor (superadmin)
 */

export type UserRole = 'student' | 'admin' | 'superadmin';
export type UserStatus = 'active' | 'suspended' | 'pending_approval';

export interface User {
  id: string;
  email: string;
  password?: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  studentIdNumber?: string;
  className?: string; // npr. 'IV-1', 'IV-2', 'IX-a'
  phone?: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string;
  durationMinutes: number;
  totalPoints: number;
  passingThresholdPercent: number;
  isMandatory: boolean;
  color: string;
  topics: string[];
}

export type QuestionDifficulty = 'basic' | 'intermediate' | 'advanced';
export type CognitiveDomain = 'knowledge' | 'comprehension' | 'application' | 'analysis';

export interface QuestionOption {
  id: string; // 'A', 'B', 'C', 'D'
  text: string;
}

export interface QuestionCategory {
  id: string;
  name: string;
  slug: string;
  subjectId: string;
  parentId?: string | null;
  path: string[]; // e.g. ['Matematika', 'Algebra', 'Kvadratne jednačine']
  description?: string;
}

export interface Question {
  id: string;
  subjectId: string;
  topic: string;
  categoryId?: string;
  categoryPath?: string[]; // e.g. ['Matematika', 'Algebra', 'Kvadratne jednačine']
  tags: string[]; // e.g. ['kvadratne-jednačine', 'završni-rok', 'teško', 'bez-kalkulatora']
  questionText: string;
  options: QuestionOption[];
  correctOptionId: string;
  points: number;
  difficulty: QuestionDifficulty;
  cognitiveDomain: CognitiveDomain;
  explanation: string;
  authorName?: string;
  authorId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExamStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface ExamCommission {
  president: string;
  supervisor1: string;
  supervisor2: string;
  evaluator: string;
}

export interface ExamPoolConfig {
  categories: string[];
  tags: string[];
  difficultyDistribution: {
    basic: number;
    intermediate: number;
    advanced: number;
  };
  questionCount: number;
  shuffleQuestions: boolean;
}

export interface ExamRulesConfig {
  passingThresholdPercent: number;
  calculatorAllowed: boolean;
  formulaSheetAllowed: boolean;
  penaltyForWrongAnswers: boolean;
  allowedTools: string[];
  notes?: string;
}

export interface ExamSession {
  id: string;
  title: string;
  description?: string;
  subjectId: string;
  subjectName: string;
  examDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate?: string;
  endTime?: string;
  durationMinutes: number;
  roomNumber: string;
  location: string;
  maxCandidates: number;
  status: ExamStatus;
  commission: ExamCommission;
  notes?: string;
  candidateCount: number;
  poolConfig?: ExamPoolConfig;
  rules?: ExamRulesConfig;
}

export interface StudentAttempt {
  id: string;
  studentId: string;
  studentName: string;
  subjectId: string;
  subjectName: string;
  scoreAchieved: number;
  maxScore: number;
  percentage: number;
  isPassed: boolean;
  durationSeconds: number;
  answers: Record<string, string>; // questionId -> selectedOptionId
  completedAt: string;
  isSimulation: boolean;
  reviewNotes?: string;
}

export type AccommodationType = 
  | 'extra_time_25' 
  | 'extra_time_50' 
  | 'large_font' 
  | 'personal_assistant' 
  | 'adapted_room' 
  | 'special_devices';

export interface StudentAccommodation {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  type: AccommodationType;
  typeLabel: string;
  legalBasis: string; // npr. 'Član 14. Pravilnika o inkluzivnom obrazovanju'
  description: string;
  approvedBy: string; // Pedagog / Psiholog
  approvedAt: string;
  isActive: boolean;
}

export type ComplianceStatus = 'compliant' | 'in_progress' | 'action_required';

export interface ComplianceRegulation {
  id: string;
  actTitle: string; // Zakonski ili podzakonski akt
  articleReference: string; // Član zakona/pravilnika
  requirementSummary: string; // Opis obaveze
  category: 'organizacija' | 'sigurnost_testova' | 'komisije' | 'rokovi' | 'ocjenjivanje' | 'inkluzija';
  status: ComplianceStatus;
  responsiblePerson: string;
  lastVerifiedAt: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress?: string;
}

export interface SchoolSettings {
  schoolName: string;
  schoolCode: string;
  cantonMinistry: string;
  academicYear: string;
  passingThresholdPercent: number;
  examPeriodTitle: string; // npr. 'Redovni junski ispitni rok 2025/2026'
  commissionPresident: string;
  schoolDirector: string;
  pedagogueName: string;
  address: string;
  contactEmail: string;
  contactPhone: string;
}

export type DocumentType = 
  | 'minutes' 
  | 'candidate_list' 
  | 'commission_resolution' 
  | 'results_summary' 
  | 'certificate';

export interface GeneratedDocument {
  id: string;
  documentType: DocumentType;
  title: string;
  protocolNumber: string;
  academicYear: string;
  generatedAt: string;
  generatedBy: string;
  htmlContent?: string;
  metadata: Record<string, any>;
}

export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'diamond';
export type BadgeCategory = 'streak' | 'subject' | 'practice' | 'mastery' | 'challenge';

export interface BadgeDefinition {
  id: string;
  title: string;
  titleDe: string;
  titleEn: string;
  description: string;
  descriptionDe: string;
  descriptionEn: string;
  category: BadgeCategory;
  tier: BadgeTier;
  iconName: string;
  maxProgress: number;
  unit: string;
  subjectId?: string;
}

export interface StudentBadgeProgress {
  badgeId: string;
  currentProgress: number;
  maxProgress: number;
  isUnlocked: boolean;
  unlockedAt?: string;
  percent: number;
}

export interface StudentBadge extends BadgeDefinition, StudentBadgeProgress {}

export interface StudentPracticeActivity {
  id: string;
  studentId: string;
  type: 'question_answered' | 'simulation_completed' | 'solution_revealed';
  subjectId?: string;
  questionId?: string;
  isCorrect?: boolean;
  timestamp: string;
}

export interface StudentBadgeSummary {
  studentId: string;
  totalBadges: number;
  unlockedCount: number;
  unlockedPercent: number;
  currentStreakDays: number;
  bestStreakDays: number;
  totalQuestionsPracticed: number;
  totalCorrectQuestions: number;
  badges: StudentBadge[];
  recentUnlocked: StudentBadge[];
}

// ==========================================
// AI TUTOR & PERSONALIZED LEARNING PLAN TYPES
// ==========================================

export type WeaknessSeverity = 'high' | 'medium' | 'low';

export interface WeaknessTopicAnalysis {
  topic: string;
  subjectId: string;
  subjectName: string;
  categoryPath?: string[];
  totalQuestionsEncountered: number;
  incorrectCount: number;
  accuracyRate: number; // percentage (0-100)
  severity: WeaknessSeverity;
  identifiedIssue: string;
  pedagogicalAdvice: string;
  sampleMissedQuestionId?: string;
  recommendedQuestionIds: string[];
}

export interface StudyModuleActionStep {
  id: string;
  text: string;
  isDone: boolean;
}

export interface StudyModulePlan {
  id: string;
  dayNumber: number;
  title: string;
  subjectId: string;
  subjectName: string;
  focusTopic: string;
  estimatedMinutes: number;
  isCompleted: boolean;
  completedAt?: string;
  keyConcepts: string[];
  commonTraps: string[];
  actionSteps: StudyModuleActionStep[];
  recommendedQuestionIds: string[];
}

export interface StudentLearningPlan {
  id: string;
  studentId: string;
  studentName: string;
  generatedAt: string;
  updatedAt: string;
  simulationsAnalyzedCount: number;
  overallSummary: string;
  projectedReadinessIncrease: number; // e.g. 18 for +18%
  overallMaturaScoreForecast: number; // e.g. 88%
  motivationalTip: string;
  weaknesses: WeaknessTopicAnalysis[];
  modules: StudyModulePlan[];
  completedActionStepsCount: number;
  totalActionStepsCount: number;
  masteredQuestionIds: string[];
  totalRecommendedQuestionsCount: number;
}

export interface AITutorChatMessage {
  id: string;
  sender: 'student' | 'tutor';
  text: string;
  timestamp: string;
  relatedTopic?: string;
  formulaBox?: string;
  exampleQuestion?: {
    questionText: string;
    explanation: string;
  };
}
