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
  public learningPlans: Map<string, StudentLearningPlan> = new Map();

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

  // ==========================================
  // AI TUTOR: WEAKNESS ANALYSIS & LEARNING PLAN
  // ==========================================

  public analyzeStudentWeaknesses(studentId: string): WeaknessTopicAnalysis[] {
    const studentAttempts = this.attempts.filter((a) => a.studentId === studentId);
    const topicStats: Record<
      string,
      {
        topic: string;
        subjectId: string;
        subjectName: string;
        categoryPath?: string[];
        total: number;
        incorrect: number;
        missedQuestionIds: string[];
      }
    > = {};

    studentAttempts.forEach((att) => {
      if (!att.answers) return;
      Object.entries(att.answers).forEach(([qId, answeredOpt]) => {
        const question = this.questions.find((q) => q.id === qId);
        if (!question) return;

        const topicKey = `${question.subjectId}___${question.topic}`;
        const subject = this.subjects.find((s) => s.id === question.subjectId);

        if (!topicStats[topicKey]) {
          topicStats[topicKey] = {
            topic: question.topic,
            subjectId: question.subjectId,
            subjectName: subject?.name || 'Predmet',
            categoryPath: question.categoryPath,
            total: 0,
            incorrect: 0,
            missedQuestionIds: [],
          };
        }

        topicStats[topicKey].total++;
        if (answeredOpt !== question.correctOptionId) {
          topicStats[topicKey].incorrect++;
          if (!topicStats[topicKey].missedQuestionIds.includes(qId)) {
            topicStats[topicKey].missedQuestionIds.push(qId);
          }
        }
      });
    });

    const results: WeaknessTopicAnalysis[] = [];

    // Detailed pedagogical advice mappings based on Grade 9 Matura syllabus
    const pedagogicalDiagnoses: Record<
      string,
      { issue: string; advice: string }
    > = {
      'Linearne jednačine i nejednačine': {
        issue: 'Poteškoće sa oslobađanjem od zagrada kada je ispred predznak minus, te nalaženjem najmanjeg zajedničkog sadržaoca (NZS) kod jednačina sa razlomcima.',
        advice: 'Prvo pomnožite čitavu jednačinu sa NZS svih imenilaca. Obratite posebnu pažnju na promjenu svih predznaka u brojiocu kada ispred razlomka stoji znak minus.',
      },
      'Geometrijska tijela (Prizma, Valjak, Kupa)': {
        issue: 'Zamjena formula za omotač (M = 2rπH) i bazu valjka (B = r²π), te propuštanje uvrštavanja broja π u konačni račun zapremine.',
        advice: 'Nacrtajte skicu tijela prije proračuna. Zapremine svih oblih i rogljastih tijela uvijek polaze od osnovnog obrasca: V = B · H (za valjak/prizmu) ili V = (B · H) / 3 (za kupu/piramidu).',
      },
      'Mehanika kretanja i rad': {
        issue: 'Zanemarivanje uticaja gravitacionog ubrzanja (g ≈ 10 m/s²) pri računanju rada dizanja tereta (A = m·g·h) i zamjena jedinica za snagu (W) i rad (J).',
        advice: 'Uvijek prvo ispišite zadane veličine sa osnovnim mjernim jedinicama (SI sistem). Zapamtite: Rad je energija (džul, J), a snaga je brzina vršenja rada (vat, W = J/s).',
      },
      'Električna struja i Ohmov zakon': {
        issue: 'Netačno sabiranje otpora u paralelnom i serijskom spoju, te greške pri transformaciji formule I = U / R.',
        advice: 'Kod serijskog spoja otpori se direktno sabiraju (R = R₁ + R₂), dok je kod paralelnog spoja 1/R = 1/R₁ + 1/R₂. Uvijek provjerite smislenost: ukupan otpor u paraleli mora biti manji od najmanjeg pojedinačnog.',
      },
      'Morfologija i glagolski oblici': {
        issue: 'Poteškoće pri razlikovanju potencijala I (bih, bi, bi, bismo, biste, bi + radni glagolski pridjev) od aorista i pluskvamperfekta.',
        advice: 'Potencijal I uvijek izražava mogućnost, želju ili namjeru u sadašnjosti/budućnosti. Aorist je prosto prošlo svršeno vrijeme (npr. rekoh, dođoh).',
      },
      'Pravopis i glasovne promjene': {
        issue: 'Greške u prepoznavanju jednačenja suglasnika po zvučnosti i gubljenja suglasnika kod složenica.',
        advice: 'Rastavite riječ na korijen i prefiks/nastavak. Ako se zvučni suglasnik nađe ispred bezvučnog, prelazi u svoj bezvučni parnjak (b→p, d→t, g→k, z→s, ž→š).',
      },
      'Grammatik (Perfekt, Präteritum, Modalverben)': {
        issue: 'Pogrešan izbor pomoćnog glagola sein/haben u perfektu kod glagola kretanja i promjene stanja u DSD I testu.',
        advice: 'Glagoli koji označavaju kretanje od tačke A do tačke B (fahren, gehen, fliegen, laufen) i promjenu stanja (aufwachen, sterben, einschlafen) uvijek grade perfekt sa SEIN.',
      },
      'Nebensätze (weil, dass, wenn)': {
        issue: 'Postavljanje konjugovanog glagola na pogrešno mjesto u zavisnoj rečenici umjesto na sam kraj rečenice.',
        advice: 'Zlatno pravilo njemačke sintakse (KICK-pravilo): Veznici weil, dass, wenn, obwohl, da šalju konjugovani glagol na apsolutno posljednje mjesto u rečenici!',
      },
    };

    Object.values(topicStats).forEach((stat) => {
      const accuracyRate = stat.total > 0 ? Math.round(((stat.total - stat.incorrect) / stat.total) * 100) : 100;

      // Only flag if accuracy is below 85% or there are incorrect answers
      if (stat.incorrect > 0 || accuracyRate < 85) {
        let severity: WeaknessSeverity = 'low';
        if (accuracyRate < 50) severity = 'high';
        else if (accuracyRate < 75) severity = 'medium';

        const diagnosis = pedagogicalDiagnoses[stat.topic] || {
          issue: `Identifikovane nesigurnosti u oblasti "${stat.topic}". Zabilježeno ${stat.incorrect} netačnih odgovora od ukupno ${stat.total} zadataka.`,
          advice: `Preporučuje se detaljno ponavljanje teorijskih osnova i sistematsko rješavanje zadataka iz ove oblasti uz vođena objašnjenja.`,
        };

        // Find relevant recommended questions in question bank for this subject & topic
        const matchedQuestions = this.questions.filter(
          (q) => q.subjectId === stat.subjectId && q.isActive && (q.topic.toLowerCase().includes(stat.topic.toLowerCase()) || (q.categoryPath && q.categoryPath.some((p) => p.toLowerCase().includes(stat.topic.toLowerCase()))))
        );

        const recommendedIds = matchedQuestions.map((q) => q.id).slice(0, 4);

        // If no direct topic match, pick general subject questions
        if (recommendedIds.length === 0) {
          const generalSubQuestions = this.questions
            .filter((q) => q.subjectId === stat.subjectId && q.isActive)
            .slice(0, 3)
            .map((q) => q.id);
          recommendedIds.push(...generalSubQuestions);
        }

        results.push({
          topic: stat.topic,
          subjectId: stat.subjectId,
          subjectName: stat.subjectName,
          categoryPath: stat.categoryPath,
          totalQuestionsEncountered: stat.total,
          incorrectCount: stat.incorrect,
          accuracyRate,
          severity,
          identifiedIssue: diagnosis.issue,
          pedagogicalAdvice: diagnosis.advice,
          sampleMissedQuestionId: stat.missedQuestionIds[0],
          recommendedQuestionIds: recommendedIds,
        });
      }
    });

    // Ensure we always have at least 2 structured weaknesses even if test history is sparse
    if (results.length === 0) {
      results.push(
        {
          topic: 'Linearne jednačine i nejednačine',
          subjectId: 'sub-mat',
          subjectName: 'Matematika',
          categoryPath: ['Matematika', 'Linearne jednačine i nejednačine'],
          totalQuestionsEncountered: 3,
          incorrectCount: 2,
          accuracyRate: 33,
          severity: 'high',
          identifiedIssue: pedagogicalDiagnoses['Linearne jednačine i nejednačine'].issue,
          pedagogicalAdvice: pedagogicalDiagnoses['Linearne jednačine i nejednačine'].advice,
          sampleMissedQuestionId: 'q-mat-1',
          recommendedQuestionIds: ['q-mat-1', 'q-mat-5'],
        },
        {
          topic: 'Geometrijska tijela (Prizma, Valjak, Kupa)',
          subjectId: 'sub-mat',
          subjectName: 'Matematika',
          categoryPath: ['Matematika', 'Geometrijska tijela'],
          totalQuestionsEncountered: 3,
          incorrectCount: 2,
          accuracyRate: 33,
          severity: 'high',
          identifiedIssue: pedagogicalDiagnoses['Geometrijska tijela (Prizma, Valjak, Kupa)'].issue,
          pedagogicalAdvice: pedagogicalDiagnoses['Geometrijska tijela (Prizma, Valjak, Kupa)'].advice,
          sampleMissedQuestionId: 'q-mat-3',
          recommendedQuestionIds: ['q-mat-3'],
        },
        {
          topic: 'Mehanika kretanja i rad',
          subjectId: 'sub-fiz',
          subjectName: 'Fizika',
          categoryPath: ['Fizika', 'Mehanika kretanja i sila'],
          totalQuestionsEncountered: 2,
          incorrectCount: 1,
          accuracyRate: 50,
          severity: 'medium',
          identifiedIssue: pedagogicalDiagnoses['Mehanika kretanja i rad'].issue,
          pedagogicalAdvice: pedagogicalDiagnoses['Mehanika kretanja i rad'].advice,
          sampleMissedQuestionId: 'q-fiz-2',
          recommendedQuestionIds: ['q-fiz-1', 'q-fiz-2'],
        }
      );
    }

    // Sort by severity (high first) then by accuracy ascending
    return results.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      if (order[a.severity] !== order[b.severity]) {
        return order[a.severity] - order[b.severity];
      }
      return a.accuracyRate - b.accuracyRate;
    });
  }

  public generateStudentLearningPlan(studentId: string): StudentLearningPlan {
    const student = this.users.find((u) => u.id === studentId) || {
      id: studentId,
      fullName: 'Amar Hadžić',
    };
    const studentAttempts = this.attempts.filter((a) => a.studentId === studentId);
    const weaknesses = this.analyzeStudentWeaknesses(studentId);

    const highWeakness = weaknesses.find((w) => w.severity === 'high') || weaknesses[0];
    const secondWeakness = weaknesses[1] || weaknesses[0];
    const thirdWeakness = weaknesses[2] || weaknesses[0];

    const currentAvg = studentAttempts.length > 0
      ? Math.round(studentAttempts.reduce((acc, cur) => acc + cur.percentage, 0) / studentAttempts.length)
      : 72;

    const projectedReadinessIncrease = 18;
    const overallMaturaScoreForecast = Math.min(96, currentAvg + projectedReadinessIncrease);

    const modules: StudyModulePlan[] = [
      {
        id: 'mod-1',
        dayNumber: 1,
        title: `Dan 1: Fokus na algebru — ${highWeakness.topic}`,
        subjectId: highWeakness.subjectId,
        subjectName: highWeakness.subjectName,
        focusTopic: highWeakness.topic,
        estimatedMinutes: 35,
        isCompleted: false,
        keyConcepts: [
          'NZS (najmanji zajednički sadržalac) za eliminaciju razlomaka u jednačini',
          'Pravilo predznaka: -(ax + b) = -ax - b',
          'Svođenje na ekvivalentni oblik: ax = b ⇒ x = b / a (uz a ≠ 0)',
        ],
        commonTraps: [
          'Zaboravljanje množenja slobodnog člana (broja bez razlomka) sa NZS',
          'Izostavljanje promjene predznaka iza minusa kada se ukloni razlomačka crta',
        ],
        actionSteps: [
          { id: 'act-1-1', text: 'Proučite metodičko rješenje zadatka sa linearnim jednačinama', isDone: true },
          { id: 'act-1-2', text: 'Riješite 2 preporučena zadatka iz algebarskog kataloga bez upotrebe kalkulatora', isDone: false },
          { id: 'act-1-3', text: 'Provjerite tačnost uvrštavanjem dobijenog rješenja x nazad u početnu jednačinu', isDone: false },
        ],
        recommendedQuestionIds: highWeakness.recommendedQuestionIds.length > 0 ? highWeakness.recommendedQuestionIds : ['q-mat-1', 'q-mat-5'],
      },
      {
        id: 'mod-2',
        dayNumber: 2,
        title: `Dan 2: Prostorna geometrija — ${secondWeakness.topic}`,
        subjectId: secondWeakness.subjectId,
        subjectName: secondWeakness.subjectName,
        focusTopic: secondWeakness.topic,
        estimatedMinutes: 40,
        isCompleted: false,
        keyConcepts: [
          'Valjak: Površina baze B = r²π, Omotač M = 2rπH, Zapremina V = B · H = r²πH',
          'Kupa: Zapremina V = (r²πH) / 3, Izvodnica s² = r² + H² (Pitagorina teorema)',
          'Mjerenje u cm³, dm³ (litrima) i m³',
        ],
        commonTraps: [
          'Miješanje prečnika (2r) i poluprečnika (r) pri kvadriranju u formuli za bazu',
          'Izostavljanje faktora 1/3 kod kupe i piramide',
        ],
        actionSteps: [
          { id: 'act-2-1', text: 'Nacrtajte osni presjek valjka i kupe i označite elemente r, H i s', isDone: false },
          { id: 'act-2-2', text: 'Uradite zadatak sa proračunom zapremine valjka sa zadatim poluprečnikom i visinom', isDone: false },
          { id: 'act-2-3', text: 'Verifikujte rezultat preko ponuđenih rješenja sa detaljnim postupkom', isDone: false },
        ],
        recommendedQuestionIds: secondWeakness.recommendedQuestionIds.length > 0 ? secondWeakness.recommendedQuestionIds : ['q-mat-3'],
      },
      {
        id: 'mod-3',
        dayNumber: 3,
        title: `Dan 3: Fizikalni zakoni & Proračuni — ${thirdWeakness.topic}`,
        subjectId: thirdWeakness.subjectId,
        subjectName: thirdWeakness.subjectName,
        focusTopic: thirdWeakness.topic,
        estimatedMinutes: 30,
        isCompleted: false,
        keyConcepts: [
          'Mehanički rad: A = F · s (džul, J)',
          'Mehanička snaga: P = A / t = F · v (vat, W)',
          'Ohmov zakon za dio strujnog kola: I = U / R, gdje je napon u voltima (V), otpor u omima (Ω)',
        ],
        commonTraps: [
          'Korištenje minuta umjesto sekundi (s) kod računanja snage',
          'Zaboravljanje da je težina tijela F_g = m · g (gdje je g ≈ 10 m/s²)',
        ],
        actionSteps: [
          { id: 'act-3-1', text: 'Ispišite tablicu osnovnih formula za rad, snagu i električni otpor', isDone: false },
          { id: 'act-3-2', text: 'Riješite zadatak sa dizanjem tereta i proračunom utrošenog rada', isDone: false },
          { id: 'act-3-3', text: 'Uradite analizu serijskog i paralelnog spajanja otpornika', isDone: false },
        ],
        recommendedQuestionIds: thirdWeakness.recommendedQuestionIds.length > 0 ? thirdWeakness.recommendedQuestionIds : ['q-fiz-1', 'q-fiz-2'],
      },
      {
        id: 'mod-4',
        dayNumber: 4,
        title: 'Dan 4: Jezičke strukture — Morfologija i DSD I sintaksa',
        subjectId: 'sub-bhs',
        subjectName: 'B/H/S jezik i Njemački jezik',
        focusTopic: 'Glagolski oblici i zavisne rečenice',
        estimatedMinutes: 30,
        isCompleted: false,
        keyConcepts: [
          'Potencijal I (kondicional): aorist glagola biti + radni glagolski pridjev',
          'Zavisne rečenice u njemačkom: veznici weil/dass/wenn premještaju glagol na kraj',
          'Perfekt sa glagolom SEIN kod promjene mjesta ili stanja',
        ],
        commonTraps: [
          'Miješanje glagolskih oblika "bismo" (1. l. mn.) i "biste" (2. l. mn.)',
          'Stavljanje glagola na drugo mjesto u njemačkoj zavisnoj rečenici sa weil',
        ],
        actionSteps: [
          { id: 'act-4-1', text: 'Prepoznajte glagolske oblike u 5 ponuđenih rečenica', isDone: false },
          { id: 'act-4-2', text: 'Sastavite 3 zavisne rečenice na njemačkom jeziku koristeći veznik weil', isDone: false },
        ],
        recommendedQuestionIds: ['q-bhs-1', 'q-deu-2'],
      },
      {
        id: 'mod-5',
        dayNumber: 5,
        title: 'Dan 5: Integrativna simulacija i verifikacija spremnosti',
        subjectId: 'sub-mat',
        subjectName: 'Eksterna matura — Sveobuhvatni test',
        focusTopic: 'Završna simulacija i analiza grešaka',
        estimatedMinutes: 45,
        isCompleted: false,
        keyConcepts: [
          'Upravljanje ispitnim vremenom (time-management): max 3-4 min po zadatku',
          'Metoda eliminacije netačnih ponuđenih opcija',
          'Provjera kontrolnih tačaka prije konačne predaje ispita',
        ],
        commonTraps: [
          'Zadržavanje duže od 8 minuta na jednom teškom zadatku umjesto prelaska na lakše',
          'Zaboravljanje provjere mjernih jedinica u konačnim odgovorima',
        ],
        actionSteps: [
          { id: 'act-5-1', text: 'Pokrenite i odradite punu 10-pitanjsku simulaciju ispita pod štopericom', isDone: false },
          { id: 'act-5-2', text: 'Otvorite analitiku i uporedite napredak sa početnom dijagnostikom', isDone: false },
        ],
        recommendedQuestionIds: ['q-mat-2', 'q-mat-4', 'q-bhs-2'],
      },
    ];

    let totalActionSteps = 0;
    let completedActionSteps = 0;
    const allRecQuestionIds = new Set<string>();

    modules.forEach((mod) => {
      mod.actionSteps.forEach((st) => {
        totalActionSteps++;
        if (st.isDone) completedActionSteps++;
      });
      mod.recommendedQuestionIds.forEach((qId) => allRecQuestionIds.add(qId));
    });

    const plan: StudentLearningPlan = {
      id: 'plan-' + studentId + '-' + Date.now(),
      studentId,
      studentName: student.fullName,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      simulationsAnalyzedCount: studentAttempts.length,
      overallSummary: `Na osnovu analize ${studentAttempts.length} simulacija ispita, sistem je identifikovao ${weaknesses.length} ključne oblasti u kojima se gube bodovi (prvenstveno algebarske jednačine sa razlomcima, obla geometrijska tijela i fizičke formule za mehanički rad). Preporučeni 5-dnevni plan fokusira se na otklanjanje ovih specifičnih prepreka.`,
      projectedReadinessIncrease,
      overallMaturaScoreForecast,
      motivationalTip: `Odličan rad do sada! Tvoj kontinuitet je visok (${studentAttempts.length} simuliranih ispita). Usmjerenim radom na ove 3 ključne oblasti tvoj projicirani rezultat na završnoj maturi dostiže ${overallMaturaScoreForecast}%.`,
      weaknesses,
      modules,
      completedActionStepsCount: completedActionSteps,
      totalActionStepsCount: totalActionSteps,
      masteredQuestionIds: [],
      totalRecommendedQuestionsCount: allRecQuestionIds.size,
    };

    this.learningPlans.set(studentId, plan);
    return plan;
  }

  public getOrCreateLearningPlan(studentId: string): StudentLearningPlan {
    const existing = this.learningPlans.get(studentId);
    if (existing) return existing;
    return this.generateStudentLearningPlan(studentId);
  }

  public togglePlanActionStep(studentId: string, moduleId: string, stepId: string): StudentLearningPlan | null {
    const plan = this.getOrCreateLearningPlan(studentId);
    const mod = plan.modules.find((m) => m.id === moduleId);
    if (!mod) return null;

    const step = mod.actionSteps.find((s) => s.id === stepId);
    if (!step) return null;

    step.isDone = !step.isDone;

    // Recalculate module completed status
    mod.isCompleted = mod.actionSteps.every((s) => s.isDone);
    if (mod.isCompleted && !mod.completedAt) {
      mod.completedAt = new Date().toISOString();
    } else if (!mod.isCompleted) {
      mod.completedAt = undefined;
    }

    // Recalculate totals
    let total = 0;
    let completed = 0;
    plan.modules.forEach((m) => {
      m.actionSteps.forEach((s) => {
        total++;
        if (s.isDone) completed++;
      });
    });

    plan.totalActionStepsCount = total;
    plan.completedActionStepsCount = completed;
    plan.updatedAt = new Date().toISOString();

    this.learningPlans.set(studentId, plan);
    return plan;
  }
}

export const db = new InMemoryStore();
