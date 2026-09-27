import {
  User,
  Subject,
  Question,
  QuestionCategory,
  ExamSession,
  StudentAttempt,
  StudentAccommodation,
  ComplianceRegulation,
  AuditLog,
  SchoolSettings,
  GeneratedDocument,
  BadgeDefinition,
  StudentPracticeActivity,
  StudentBadgeSummary,
  StudentBadge,
  StudentLearningPlan,
  WeaknessTopicAnalysis,
  StudyModulePlan,
  WeaknessSeverity,
} from '../types/index.ts';
import {
  initialUsers,
  initialSubjects,
  initialCategories,
  initialQuestions,
  initialExamSessions,
  initialAttempts,
  initialAccommodations,
  initialRegulations,
  initialAuditLogs,
  initialSchoolSettings,
  initialBadges,
  initialPracticeActivities,
} from './mockData.ts';

class InMemoryStore {
  public users: User[] = [...initialUsers];
  public subjects: Subject[] = [...initialSubjects];
  public categories: QuestionCategory[] = [...initialCategories];
  public questions: Question[] = [...initialQuestions];
  public examSessions: ExamSession[] = [...initialExamSessions];
  public attempts: StudentAttempt[] = [...initialAttempts];
  public accommodations: StudentAccommodation[] = [...initialAccommodations];
  public regulations: ComplianceRegulation[] = [...initialRegulations];
  public auditLogs: AuditLog[] = [...initialAuditLogs];
  public schoolSettings: SchoolSettings = { ...initialSchoolSettings };
  public documents: GeneratedDocument[] = [];
  public badges: BadgeDefinition[] = [...initialBadges];
  public practiceActivities: StudentPracticeActivity[] = [...initialPracticeActivities];

  constructor() {
    this.initDefaultDocuments();
  }

  private initDefaultDocuments() {
    this.documents = [
      {
        id: 'doc-proto-1',
        documentType: 'minutes',
        title: 'Zapisnik o toku provođenja ispita iz B/H/S jezika',
        protocolNumber: '02-120/26',
        academicYear: '2025/2026',
        generatedAt: '2026-03-20T10:00:00Z',
        generatedBy: 'Mag. Thomas Weber',
        metadata: {
          sessionTitle: 'Eksterna matura IX razred: B/H/S jezik i književnost',
          room: 'Učionica 101',
          date: '2026-06-15',
        },
      },
      {
        id: 'doc-proto-2',
        documentType: 'commission_resolution',
        title: 'Rješenje o imenovanju ispitne komisije i dežurnih nastavnika za IX razred',
        protocolNumber: '01-85/26',
        academicYear: '2025/2026',
        generatedAt: '2026-03-18T12:00:00Z',
        generatedBy: 'Mag. Thomas Weber',
        metadata: {
          president: 'Prof. dr. Ismar Hadžiosmanović',
          totalSupervisors: 6,
        },
      },
    ];
  }

  public getAllTags(): string[] {
    const tagSet = new Set<string>();
    this.questions.forEach((q) => {
      if (q.tags && Array.isArray(q.tags)) {
        q.tags.forEach((t) => tagSet.add(t));
      }
    });
    return Array.from(tagSet).sort();
  }

  public addAuditLog(
    userId: string,
    userEmail: string,
    userRole: any,
    action: string,
    entityType: string,
    entityId: string,
    details: string,
    ipAddress: string = '127.0.0.1'
  ) {
    const log: AuditLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      userId,
      userEmail,
      userRole,
      action,
      entityType,
      entityId,
      details,
      ipAddress,
    };
    this.auditLogs.unshift(log);
    return log;
  }

  public recordPracticeActivity(
    studentId: string,
    type: 'question_answered' | 'simulation_completed' | 'solution_revealed',
    subjectId?: string,
    questionId?: string,
    isCorrect?: boolean
  ): StudentPracticeActivity {
    const activity: StudentPracticeActivity = {
      id: 'act-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      studentId,
      type,
      subjectId,
      questionId,
      isCorrect,
      timestamp: new Date().toISOString(),
    };
    this.practiceActivities.unshift(activity);
    return activity;
  }

  public getStudentBadgeSummary(studentId: string): StudentBadgeSummary {
    const studentAttempts = this.attempts.filter((a) => a.studentId === studentId);
    const studentActivities = this.practiceActivities.filter((a) => a.studentId === studentId);

    // 1. Calculate active calendar days & streak
    const activeDatesSet = new Set<string>();
    studentAttempts.forEach((a) => {
      activeDatesSet.add(a.completedAt.split('T')[0]);
    });
    studentActivities.forEach((act) => {
      activeDatesSet.add(act.timestamp.split('T')[0]);
    });

    const sortedDates = Array.from(activeDatesSet).sort().reverse();
    let currentStreakDays = 0;
    if (sortedDates.length > 0) {
      currentStreakDays = 1;
      for (let i = 0; i < sortedDates.length - 1; i++) {
        const d1 = new Date(sortedDates[i]);
        const d2 = new Date(sortedDates[i + 1]);
        const diffDays = Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currentStreakDays++;
        } else {
          break;
        }
      }
    }
    const bestStreakDays = Math.max(currentStreakDays, sortedDates.length);

    // 2. Practice volume stats
    const answeredActs = studentActivities.filter((a) => a.type === 'question_answered');
    const totalQuestionsPracticed = answeredActs.length;
    const totalCorrectQuestions = answeredActs.filter((a) => a.isCorrect).length;
    const totalSolutionsViewed = studentActivities.filter((a) => a.type === 'solution_revealed').length;

    // 3. Subject-specific simulation counts with high scores
    const mathHighScores = studentAttempts.filter((a) => a.subjectId === 'sub-mat' && a.percentage >= 85).length;
    const deuHighScores = studentAttempts.filter((a) => a.subjectId === 'sub-deu' && a.percentage >= 90).length;
    const bhsHighScores = studentAttempts.filter((a) => a.subjectId === 'sub-bhs' && a.percentage >= 85).length;
    const engHighScores = studentAttempts.filter((a) => a.subjectId === 'sub-eng' && a.percentage >= 90).length;

    // 4. Distinct passed subjects
    const passedSubjectsSet = new Set(studentAttempts.filter((a) => a.isPassed).map((a) => a.subjectId));
    const passedSubjectsCount = passedSubjectsSet.size;

    // 5. Special challenge checks
    const hasPerfectScore = studentAttempts.some((a) => a.percentage === 100);
    const hasSpeedDemon = studentAttempts.some((a) => {
      const sub = this.subjects.find((s) => s.id === a.subjectId);
      const halfTimeSecs = ((sub?.durationMinutes || 90) * 60) / 2;
      return a.percentage >= 80 && a.durationSeconds <= halfTimeSecs;
    });

    const overallAverage = studentAttempts.length > 0
      ? Math.round(studentAttempts.reduce((acc, cur) => acc + cur.percentage, 0) / studentAttempts.length)
      : 0;

    // Evaluate each badge
    const badges: StudentBadge[] = this.badges.map((b) => {
      let currentProgress = 0;
      let isUnlocked = false;
      let unlockedAt: string | undefined = undefined;

      switch (b.id) {
        case 'streak-bronze':
          currentProgress = Math.min(currentStreakDays, 3);
          isUnlocked = currentStreakDays >= 3;
          if (isUnlocked) unlockedAt = sortedDates[sortedDates.length >= 3 ? sortedDates.length - 3 : 0];
          break;
        case 'streak-silver':
          currentProgress = Math.min(currentStreakDays, 7);
          isUnlocked = currentStreakDays >= 7;
          if (isUnlocked) unlockedAt = sortedDates[0];
          break;
        case 'streak-gold':
          currentProgress = Math.min(currentStreakDays, 14);
          isUnlocked = currentStreakDays >= 14;
          if (isUnlocked) unlockedAt = sortedDates[0];
          break;
        case 'math-expert':
          currentProgress = Math.min(mathHighScores, 2);
          isUnlocked = mathHighScores >= 2;
          if (isUnlocked && studentAttempts[0]) unlockedAt = studentAttempts[0].completedAt;
          break;
        case 'deutsch-meister':
          currentProgress = Math.min(deuHighScores, 1);
          isUnlocked = deuHighScores >= 1;
          if (isUnlocked) {
            const att = studentAttempts.find((a) => a.subjectId === 'sub-deu' && a.percentage >= 90);
            unlockedAt = att?.completedAt;
          }
          break;
        case 'bhs-scholar':
          currentProgress = Math.min(bhsHighScores, 1);
          isUnlocked = bhsHighScores >= 1;
          if (isUnlocked) {
            const att = studentAttempts.find((a) => a.subjectId === 'sub-bhs' && a.percentage >= 85);
            unlockedAt = att?.completedAt;
          }
          break;
        case 'english-pro':
          currentProgress = Math.min(engHighScores, 1);
          isUnlocked = engHighScores >= 1;
          if (isUnlocked) {
            const att = studentAttempts.find((a) => a.subjectId === 'sub-eng' && a.percentage >= 90);
            unlockedAt = att?.completedAt;
          }
          break;
        case 'practice-pioneer':
          currentProgress = Math.min(totalQuestionsPracticed, 15);
          isUnlocked = totalQuestionsPracticed >= 15;
          if (isUnlocked) unlockedAt = studentActivities[0]?.timestamp;
          break;
        case 'practice-centurion':
          currentProgress = Math.min(totalQuestionsPracticed, 30);
          isUnlocked = totalQuestionsPracticed >= 30;
          if (isUnlocked) unlockedAt = studentActivities[0]?.timestamp;
          break;
        case 'solution-explorer':
          currentProgress = Math.min(totalSolutionsViewed, 8);
          isUnlocked = totalSolutionsViewed >= 8;
          if (isUnlocked) unlockedAt = studentActivities[0]?.timestamp;
          break;
        case 'perfectionist':
          currentProgress = hasPerfectScore ? 1 : 0;
          isUnlocked = hasPerfectScore;
          if (isUnlocked) {
            const att = studentAttempts.find((a) => a.percentage === 100);
            unlockedAt = att?.completedAt;
          }
          break;
        case 'speed-demon':
          currentProgress = hasSpeedDemon ? 1 : 0;
          isUnlocked = hasSpeedDemon;
          if (isUnlocked && studentAttempts[0]) unlockedAt = studentAttempts[0].completedAt;
          break;
        case 'all-rounder':
          currentProgress = Math.min(passedSubjectsCount, 3);
          isUnlocked = passedSubjectsCount >= 3;
          if (isUnlocked && studentAttempts[0]) unlockedAt = studentAttempts[0].completedAt;
          break;
        case 'matura-ready':
          currentProgress = Math.min(overallAverage, 85);
          isUnlocked = overallAverage >= 85 && studentAttempts.length >= 2;
          if (isUnlocked && studentAttempts[0]) unlockedAt = studentAttempts[0].completedAt;
          break;
        default:
          currentProgress = 0;
          isUnlocked = false;
      }

      const percent = Math.min(100, Math.round((currentProgress / b.maxProgress) * 100));

      return {
        ...b,
        badgeId: b.id,
        currentProgress,
        maxProgress: b.maxProgress,
        isUnlocked,
        unlockedAt,
        percent,
      };
    });

    const unlockedCount = badges.filter((b) => b.isUnlocked).length;
    const unlockedPercent = Math.round((unlockedCount / badges.length) * 100);
    const recentUnlocked = badges.filter((b) => b.isUnlocked).slice(0, 4);

    return {
      studentId,
      totalBadges: badges.length,
      unlockedCount,
      unlockedPercent,
      currentStreakDays,
      bestStreakDays,
      totalQuestionsPracticed,
      totalCorrectQuestions,
      badges,
      recentUnlocked,
    };
  }
}

export const db = new InMemoryStore();
