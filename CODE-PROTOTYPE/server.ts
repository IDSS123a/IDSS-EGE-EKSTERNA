import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/server/db.ts';
import {
  Question,
  QuestionCategory,
  ExamSession,
  StudentAttempt,
  StudentAccommodation,
  User,
  DocumentType,
} from './src/types/index.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json());

  // Helper middleware to extract mock authenticated user from header
  const getAuthUser = (req: Request): User => {
    const userId = req.headers['x-user-id'] as string;
    if (userId) {
      const user = db.users.find((u) => u.id === userId);
      if (user) return user;
    }
    return db.users[0]; // fallback
  };

  // ==========================================
  // AUTHENTICATION & USERS
  // ==========================================

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'E-mail adresa je obavezna.' });
    }

    const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Korisnički račun sa navedenom e-mail adresom ne postoji.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Korisnički račun je privremeno deaktiviran.' });
    }

    db.addAuditLog(
      user.id,
      user.email,
      user.role,
      'KORISNIK_PRIJAVLJEN',
      'User',
      user.id,
      `Uspješna prijava korisnika ${user.fullName} (${user.role}) u sistem.`,
      req.ip || '127.0.0.1'
    );

    res.json({
      token: 'jwt-token-' + user.id,
      user,
    });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { email, fullName, role, className, studentIdNumber, phone } = req.body;

    if (!email || !fullName) {
      return res.status(400).json({ error: 'Ime i prezime i e-mail adresa su obavezna polja.' });
    }

    const existing = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'Korisnik sa ovom e-mail adresom već postoji u bazi.' });
    }

    const newUser: User = {
      id: 'user-' + Date.now(),
      email,
      fullName,
      role: role || 'student',
      status: 'active',
      className: className || (role === 'student' ? 'IV-1' : undefined),
      studentIdNumber: studentIdNumber || (role === 'student' ? `MAT-2026-${Math.floor(100 + Math.random() * 900)}` : undefined),
      phone: phone || '',
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);

    db.addAuditLog(
      newUser.id,
      newUser.email,
      newUser.role,
      'KORISNIK_REGISTROVAN',
      'User',
      newUser.id,
      `Kreiran novi nalog za ${newUser.fullName} s ulogom ${newUser.role}.`,
      req.ip || '127.0.0.1'
    );

    res.status(201).json({
      token: 'jwt-token-' + newUser.id,
      user: newUser,
    });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const user = getAuthUser(req);
    res.json(user);
  });

  app.get('/api/users', (_req: Request, res: Response) => {
    res.json(db.users);
  });

  app.put('/api/users/:id/role', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ error: 'Samo direktor (superadmin) može mijenjati uloge korisnika.' });
    }

    const { role } = req.body;
    const targetUser = db.users.find((u) => u.id === req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Korisnik nije pronađen.' });
    }

    targetUser.role = role;
    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'KORISNIK_ULOGA_IZMIJENJENA',
      'User',
      targetUser.id,
      `Korisniku ${targetUser.fullName} dodijeljena nova uloga: ${role}.`,
      req.ip || '127.0.0.1'
    );

    res.json(targetUser);
  });

  app.put('/api/users/:id/status', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ error: 'Samo direktor (superadmin) može mijenjati status korisnika.' });
    }

    const { status } = req.body;
    const targetUser = db.users.find((u) => u.id === req.params.id);
    if (!targetUser) {
      return res.status(404).json({ error: 'Korisnik nije pronađen.' });
    }

    targetUser.status = status;
    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'KORISNIK_STATUS_IZMIJENJEN',
      'User',
      targetUser.id,
      `Korisniku ${targetUser.fullName} postavljen status: ${status}.`,
      req.ip || '127.0.0.1'
    );

    res.json(targetUser);
  });

  // ==========================================
  // HIERARCHICAL CATEGORIES & TAGS
  // ==========================================

  app.get('/api/categories', (req: Request, res: Response) => {
    const { subjectId } = req.query;
    let list = db.categories;
    if (subjectId) {
      list = list.filter((c) => c.subjectId === subjectId);
    }
    res.json(list);
  });

  app.post('/api/categories', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role === 'student') {
      return res.status(403).json({ error: 'Samo nastavnici i administratori mogu definisati kategorije.' });
    }

    const { name, subjectId, parentId, description } = req.body;
    if (!name || !subjectId) {
      return res.status(400).json({ error: 'Naziv kategorije i pripadajući predmet su obavezni.' });
    }

    let path = [name];
    if (parentId) {
      const parent = db.categories.find((c) => c.id === parentId);
      if (parent) {
        path = [...parent.path, name];
      }
    }

    const newCategory: QuestionCategory = {
      id: 'cat-' + Date.now(),
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      subjectId,
      parentId: parentId || null,
      path,
      description,
    };

    db.categories.push(newCategory);

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'KATEGORIJA_DODANA',
      'QuestionCategory',
      newCategory.id,
      `Dodana nova kategorija: "${newCategory.path.join(' > ')}" za predmet ${subjectId}.`,
      req.ip || '127.0.0.1'
    );

    res.status(201).json(newCategory);
  });

  app.get('/api/tags', (_req: Request, res: Response) => {
    res.json(db.getAllTags());
  });

  // ==========================================
  // SUBJECTS & QUESTIONS (WITH TAGS & CATEGORIES)
  // ==========================================

  app.get('/api/subjects', (_req: Request, res: Response) => {
    res.json(db.subjects);
  });

  app.get('/api/questions', (req: Request, res: Response) => {
    const { subjectId, categoryId, categoryName, tag, difficulty, domain, search } = req.query;
    let list = db.questions;

    if (subjectId) {
      list = list.filter((q) => q.subjectId === subjectId);
    }
    if (categoryId) {
      list = list.filter((q) => q.categoryId === categoryId);
    }
    if (categoryName) {
      const cLower = String(categoryName).toLowerCase();
      list = list.filter((q) => q.categoryPath && q.categoryPath.some((p) => p.toLowerCase().includes(cLower)));
    }
    if (tag) {
      const tagLower = String(tag).toLowerCase();
      list = list.filter((q) => q.tags && q.tags.some((t) => t.toLowerCase() === tagLower));
    }
    if (difficulty) {
      list = list.filter((q) => q.difficulty === difficulty);
    }
    if (domain) {
      list = list.filter((q) => q.cognitiveDomain === domain);
    }
    if (search) {
      const qLower = String(search).toLowerCase();
      list = list.filter(
        (q) =>
          q.questionText.toLowerCase().includes(qLower) ||
          q.topic.toLowerCase().includes(qLower) ||
          (q.tags && q.tags.some((t) => t.toLowerCase().includes(qLower)))
      );
    }

    res.json(list);
  });

  app.post('/api/questions', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role === 'student') {
      return res.status(403).json({ error: 'Učenici nemaju ovlaštenje za dodavanje ispitnih pitanja.' });
    }

    const {
      subjectId,
      topic,
      categoryId,
      categoryPath,
      tags,
      questionText,
      options,
      correctOptionId,
      points,
      difficulty,
      cognitiveDomain,
      explanation,
    } = req.body;

    if (!subjectId || !questionText || !options || !correctOptionId) {
      return res.status(400).json({ error: 'Molimo popunite sva obavezna polja za ispitno pitanje.' });
    }

    let resolvedPath = categoryPath;
    if (categoryId && !resolvedPath) {
      const cat = db.categories.find((c) => c.id === categoryId);
      if (cat) resolvedPath = cat.path;
    }

    const newQuestion: Question = {
      id: 'q-' + Date.now(),
      subjectId,
      topic: topic || 'Opšte gradivo',
      categoryId: categoryId || undefined,
      categoryPath: resolvedPath || [topic || 'Opšte'],
      tags: Array.isArray(tags) ? tags : [],
      questionText,
      options,
      correctOptionId,
      points: Number(points) || 2,
      difficulty: difficulty || 'intermediate',
      cognitiveDomain: cognitiveDomain || 'comprehension',
      explanation: explanation || 'Nema posebnog objašnjenja.',
      authorName: currentUser.fullName,
      authorId: currentUser.id,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.questions.push(newQuestion);

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'PITANJE_DODANO',
      'Question',
      newQuestion.id,
      `Dodano pitanje u bazu (Predmet: ${subjectId}, Oznake: [${newQuestion.tags.join(', ')}]).`,
      req.ip || '127.0.0.1'
    );

    res.status(201).json(newQuestion);
  });

  app.put('/api/questions/:id', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role === 'student') {
      return res.status(403).json({ error: 'Učenici nemaju ovlaštenje za izmjenu pitanja.' });
    }

    const index = db.questions.findIndex((q) => q.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Ispitno pitanje nije pronađeno.' });
    }

    db.questions[index] = {
      ...db.questions[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'PITANJE_AŽURIRANO',
      'Question',
      req.params.id,
      `Ažurirano pitanje ${req.params.id} od strane ${currentUser.fullName}.`,
      req.ip || '127.0.0.1'
    );

    res.json(db.questions[index]);
  });

  app.delete('/api/questions/:id', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role === 'student') {
      return res.status(403).json({ error: 'Učenici nemaju ovlaštenje za brisanje pitanja.' });
    }

    const question = db.questions.find((q) => q.id === req.params.id);
    if (!question) {
      return res.status(404).json({ error: 'Ispitno pitanje nije pronađeno.' });
    }

    db.questions = db.questions.filter((q) => q.id !== req.params.id);

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'PITANJE_OBRISANO',
      'Question',
      req.params.id,
      `Obrisano pitanje iz predmeta ${question.subjectId}.`,
      req.ip || '127.0.0.1'
    );

    res.json({ success: true, message: 'Pitanje uspješno uklonjeno iz baze.' });
  });

  // ==========================================
  // EXAM SCHEDULING & CONFIGURATION MODULE
  // ==========================================

  app.get('/api/exams', (_req: Request, res: Response) => {
    res.json(db.examSessions);
  });

  app.post('/api/exams', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role === 'student') {
      return res.status(403).json({ error: 'Samo administratori mogu konfigurisati i raspoređivati ispite.' });
    }

    const {
      title,
      description,
      subjectId,
      examDate,
      startTime,
      endDate,
      endTime,
      durationMinutes,
      roomNumber,
      location,
      maxCandidates,
      commission,
      poolConfig,
      rules,
      notes,
    } = req.body;

    const subject = db.subjects.find((s) => s.id === subjectId);

    const newSession: ExamSession = {
      id: 'sess-' + Date.now(),
      title: title || `Eksterna matura: ${subject?.name || 'Predmet'}`,
      description: description || 'Zvanični ispit eksterne mature',
      subjectId,
      subjectName: subject?.name || 'Predmet',
      examDate,
      startTime,
      endDate: endDate || examDate,
      endTime: endTime || '11:00',
      durationMinutes: Number(durationMinutes) || 90,
      roomNumber,
      location: location || 'Glavna zgrada škole',
      maxCandidates: Number(maxCandidates) || 30,
      status: 'scheduled',
      candidateCount: Math.floor(Number(maxCandidates) * 0.85) || 20,
      commission: commission || {
        president: db.schoolSettings.commissionPresident,
        supervisor1: 'Prof. Dežurni 1',
        supervisor2: 'Prof. Dežurni 2',
        evaluator: 'Predmetni nastavnik',
      },
      poolConfig: poolConfig || {
        categories: [],
        tags: [],
        difficultyDistribution: { basic: 40, intermediate: 40, advanced: 20 },
        questionCount: 20,
        shuffleQuestions: true,
      },
      rules: rules || {
        passingThresholdPercent: 50,
        calculatorAllowed: false,
        formulaSheetAllowed: false,
        penaltyForWrongAnswers: false,
        allowedTools: ['Plava hemijska olovka', 'Lični identifikacioni dokument'],
        notes: notes || '',
      },
      notes,
    };

    db.examSessions.push(newSession);

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'ISPIT_KONFIGURISAN_I_ZAKAZAN',
      'ExamSession',
      newSession.id,
      `Konfigurisan novi ispit "${newSession.title}" za dan ${examDate} u ${roomNumber} sa parametrima bazena pitanja.`,
      req.ip || '127.0.0.1'
    );

    res.status(201).json(newSession);
  });

  app.put('/api/exams/:id', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role === 'student') {
      return res.status(403).json({ error: 'Nemate ovlaštenje za izmjenu konfiguracije ispita.' });
    }

    const index = db.examSessions.findIndex((s) => s.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Ispit nije pronađen.' });
    }

    db.examSessions[index] = {
      ...db.examSessions[index],
      ...req.body,
    };

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'ISPITNA_KONFIGURACIJA_AŽURIRANA',
      'ExamSession',
      req.params.id,
      `Ažurirana konfiguracija ispita ${db.examSessions[index].title}.`,
      req.ip || '127.0.0.1'
    );

    res.json(db.examSessions[index]);
  });

  app.delete('/api/exams/:id', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role === 'student') {
      return res.status(403).json({ error: 'Nemate ovlaštenje za otkazivanje ispita.' });
    }

    const session = db.examSessions.find((s) => s.id === req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Ispitna sesija nije pronađena.' });
    }

    db.examSessions = db.examSessions.filter((s) => s.id !== req.params.id);

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'ISPIT_OTKAZAN',
      'ExamSession',
      req.params.id,
      `Otkazan ispit ${session.title}.`,
      req.ip || '127.0.0.1'
    );

    res.json({ success: true, message: 'Ispit uspješno uklonjen/otkazan.' });
  });

  // Draw pool preview for an exam
  app.get('/api/exams/:id/draw-pool', (req: Request, res: Response) => {
    const session = db.examSessions.find((s) => s.id === req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Ispit nije pronađen.' });
    }

    let candidates = db.questions.filter((q) => q.subjectId === session.subjectId && q.isActive);

    if (session.poolConfig?.categories && session.poolConfig.categories.length > 0) {
      candidates = candidates.filter((q) =>
        session.poolConfig!.categories.some(
          (cat) => q.topic.toLowerCase().includes(cat.toLowerCase()) || (q.categoryPath && q.categoryPath.some((p) => p.toLowerCase().includes(cat.toLowerCase())))
        )
      );
    }

    if (session.poolConfig?.tags && session.poolConfig.tags.length > 0) {
      candidates = candidates.filter((q) =>
        session.poolConfig!.tags.some((tag) => q.tags && q.tags.includes(tag))
      );
    }

    res.json({
      examTitle: session.title,
      totalMatchedInPool: candidates.length,
      sampleQuestions: candidates.slice(0, session.poolConfig?.questionCount || 10),
    });
  });

  // ==========================================
  // STUDENT SIMULATION & ATTEMPTS
  // ==========================================

  app.get('/api/exams/generate-simulation/:subjectId', (req: Request, res: Response) => {
    const { subjectId } = req.params;
    const questions = db.questions.filter((q) => q.subjectId === subjectId && q.isActive);

    if (questions.length === 0) {
      return res.status(404).json({ error: 'Nema dostupnih ispitnih pitanja za odabrani predmet.' });
    }

    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 10);
    const subject = db.subjects.find((s) => s.id === subjectId);

    res.json({
      subject,
      totalQuestions: selected.length,
      durationMinutes: subject?.durationMinutes || 90,
      questions: selected,
    });
  });

  app.post('/api/student/attempts', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const { subjectId, answers, durationSeconds } = req.body;

    const subject = db.subjects.find((s) => s.id === subjectId);
    const questions = db.questions.filter((q) => q.subjectId === subjectId);

    let scoreAchieved = 0;
    let maxScore = 0;

    questions.forEach((q) => {
      maxScore += q.points;
      if (answers[q.id] === q.correctOptionId) {
        scoreAchieved += q.points;
      }
    });

    if (maxScore === 0) maxScore = 100;
    const percentage = Math.round((scoreAchieved / maxScore) * 100);
    const isPassed = percentage >= (subject?.passingThresholdPercent || 50);

    const beforeBadges = db.getStudentBadgeSummary(currentUser.id).badges.filter((b) => b.isUnlocked).map((b) => b.id);

    const attempt: StudentAttempt = {
      id: 'att-' + Date.now(),
      studentId: currentUser.id,
      studentName: currentUser.fullName,
      subjectId,
      subjectName: subject?.name || 'Predmet',
      scoreAchieved,
      maxScore,
      percentage,
      isPassed,
      durationSeconds: Number(durationSeconds) || 1800,
      answers,
      completedAt: new Date().toISOString(),
      isSimulation: true,
      reviewNotes: isPassed
        ? `Uspješno položen simulirani ispit. Ostvaren rezultat: ${percentage}%.`
        : `Nije ostvaren minimalni prag prolaznosti (${subject?.passingThresholdPercent || 50}%). Preporučuje se dodatno ponavljanje gradiva.`,
    };

    db.attempts.unshift(attempt);

    // Also record as a practice/simulation activity
    db.recordPracticeActivity(currentUser.id, 'simulation_completed', subjectId);

    const afterSummary = db.getStudentBadgeSummary(currentUser.id);
    const newlyUnlockedBadges = afterSummary.badges.filter((b) => b.isUnlocked && !beforeBadges.includes(b.id));

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'SIMULACIJA_ISPITA_PREDATA',
      'StudentAttempt',
      attempt.id,
      `Učenik ${currentUser.fullName} završio simulirani ispit (${attempt.subjectName}) s rezultatom ${percentage}%. ${newlyUnlockedBadges.length > 0 ? `Otključano znački: ${newlyUnlockedBadges.length}` : ''}`,
      req.ip || '127.0.0.1'
    );

    res.status(201).json({
      ...attempt,
      newlyUnlockedBadges,
      badgeSummary: afterSummary,
    });
  });

  app.get('/api/student/badges', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const studentId = (req.query.studentId as string) || currentUser.id;
    const summary = db.getStudentBadgeSummary(studentId);
    res.json(summary);
  });

  app.post('/api/student/practice-activity', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const { type, subjectId, questionId, isCorrect } = req.body;

    const beforeBadges = db.getStudentBadgeSummary(currentUser.id).badges.filter((b) => b.isUnlocked).map((b) => b.id);

    const activity = db.recordPracticeActivity(
      currentUser.id,
      type || 'question_answered',
      subjectId,
      questionId,
      isCorrect
    );

    const afterSummary = db.getStudentBadgeSummary(currentUser.id);
    const newlyUnlockedBadges = afterSummary.badges.filter((b) => b.isUnlocked && !beforeBadges.includes(b.id));

    res.status(201).json({
      activity,
      summary: afterSummary,
      newlyUnlockedBadges,
    });
  });

  app.get('/api/student/attempts', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const { studentId } = req.query;

    if (currentUser.role === 'student') {
      const myAttempts = db.attempts.filter((a) => a.studentId === currentUser.id);
      return res.json(myAttempts);
    }

    if (studentId) {
      const filtered = db.attempts.filter((a) => a.studentId === studentId);
      return res.json(filtered);
    }

    res.json(db.attempts);
  });

  app.get('/api/student/analytics', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const studentId = (req.query.studentId as string) || currentUser.id;

    const studentAttempts = db.attempts.filter((a) => a.studentId === studentId);

    const subjectStats = db.subjects.map((sub) => {
      const subAttempts = studentAttempts.filter((a) => a.subjectId === sub.id);
      const avgScore = subAttempts.length > 0
        ? Math.round(subAttempts.reduce((acc, cur) => acc + cur.percentage, 0) / subAttempts.length)
        : 0;
      const passedCount = subAttempts.filter((a) => a.isPassed).length;

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        code: sub.code,
        color: sub.color,
        attemptsCount: subAttempts.length,
        averagePercentage: avgScore,
        passedCount,
        readinessStatus: avgScore >= 75 ? 'Visoka' : avgScore >= 50 ? 'Zadovoljavajuća' : avgScore > 0 ? 'Potreban rad' : 'Nije testirano',
      };
    });

    const totalSimulations = studentAttempts.length;
    const passedSimulations = studentAttempts.filter((a) => a.isPassed).length;
    const overallAverage = totalSimulations > 0
      ? Math.round(studentAttempts.reduce((acc, cur) => acc + cur.percentage, 0) / totalSimulations)
      : 0;

    res.json({
      studentId,
      totalSimulations,
      passedSimulations,
      passRatePercent: totalSimulations > 0 ? Math.round((passedSimulations / totalSimulations) * 100) : 0,
      overallAverage,
      subjectStats,
      recentAttempts: studentAttempts.slice(0, 5),
    });
  });

  // ==========================================
  // ADMIN MONITORING & ACCOMMODATIONS
  // ==========================================

  app.get('/api/admin/overview', (_req: Request, res: Response) => {
    const students = db.users.filter((u) => u.role === 'student');
    const totalStudents = students.length;

    const classNames = Array.from(new Set(students.map((s) => s.className).filter(Boolean)));
    const classBreakdown = classNames.map((cName) => {
      const classStudents = students.filter((s) => s.className === cName);
      const studentIds = classStudents.map((s) => s.id);
      const classAttempts = db.attempts.filter((a) => studentIds.includes(a.studentId));
      const avg = classAttempts.length > 0
        ? Math.round(classAttempts.reduce((acc, cur) => acc + cur.percentage, 0) / classAttempts.length)
        : 0;

      return {
        className: cName,
        studentCount: classStudents.length,
        attemptsCount: classAttempts.length,
        averagePercentage: avg,
        atRiskCount: classAttempts.filter((a) => a.percentage < 50).length,
      };
    });

    const atRiskStudents = students.filter((s) => {
      const studentAttempts = db.attempts.filter((a) => a.studentId === s.id);
      if (studentAttempts.length === 0) return false;
      const avg = studentAttempts.reduce((acc, cur) => acc + cur.percentage, 0) / studentAttempts.length;
      return avg < 50;
    });

    res.json({
      totalStudents,
      totalExamSessions: db.examSessions.length,
      totalQuestions: db.questions.length,
      totalAccommodations: db.accommodations.filter((a) => a.isActive).length,
      classBreakdown,
      atRiskStudents,
    });
  });

  app.get('/api/admin/accommodations', (_req: Request, res: Response) => {
    res.json(db.accommodations);
  });

  app.post('/api/admin/accommodations', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role === 'student') {
      return res.status(403).json({ error: 'Nemate ovlaštenje za evidenciju pedagoških prilagodbi.' });
    }

    const { studentId, type, legalBasis, description } = req.body;
    const student = db.users.find((u) => u.id === studentId);

    const typeLabels: Record<string, string> = {
      extra_time_25: 'Dodatno vrijeme za rad (+25%)',
      extra_time_50: 'Dodatno vrijeme za rad (+50%)',
      large_font: 'Prilagođeni font i format (A3 / 16pt)',
      personal_assistant: 'Prisustvo personalnog asistenta',
      adapted_room: 'Posebna prostorija za polaganje',
      special_devices: 'Upotreba asistivne tehnologije / računara',
    };

    const newAcc: StudentAccommodation = {
      id: 'acc-' + Date.now(),
      studentId,
      studentName: student?.fullName || 'Učenik',
      className: student?.className || 'IV-1',
      type,
      typeLabel: typeLabels[type] || 'Individualna prilagodba',
      legalBasis: legalBasis || 'Član 14. Pravilnika o inkluzivnom obrazovanju',
      description,
      approvedBy: `${currentUser.fullName} (${currentUser.role === 'admin' ? 'Pedagog/Nastavnik' : 'Direktor'})`,
      approvedAt: new Date().toISOString(),
      isActive: true,
    };

    db.accommodations.push(newAcc);

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'PRILAGODBA_EVIDENTIRANA',
      'StudentAccommodation',
      newAcc.id,
      `Evidentirana prilagodba "${newAcc.typeLabel}" za učenika ${newAcc.studentName}.`,
      req.ip || '127.0.0.1'
    );

    res.status(201).json(newAcc);
  });

  // ==========================================
  // DOCUMENT GENERATION
  // ==========================================

  app.get('/api/documents', (_req: Request, res: Response) => {
    res.json(db.documents);
  });

  app.post('/api/documents/generate', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role === 'student') {
      return res.status(403).json({ error: 'Nemate ovlaštenje za generisanje službenih akata.' });
    }

    const { documentType, title, metadata } = req.body;
    const protocolNumber = `${Math.floor(10 + Math.random() * 89)}-${Math.floor(100 + Math.random() * 900)}/${new Date().getFullYear().toString().slice(2)}`;

    const newDoc = {
      id: 'doc-' + Date.now(),
      documentType: documentType as DocumentType,
      title: title || 'Službeni dokument eksterne mature',
      protocolNumber,
      academicYear: db.schoolSettings.academicYear,
      generatedAt: new Date().toISOString(),
      generatedBy: currentUser.fullName,
      metadata: metadata || {},
    };

    db.documents.unshift(newDoc);

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'DOKUMENT_GENERISAN',
      'GeneratedDocument',
      newDoc.id,
      `Kreiran službeni dokument: ${newDoc.title} (Broj protokola: ${protocolNumber}).`,
      req.ip || '127.0.0.1'
    );

    res.status(201).json(newDoc);
  });

  // ==========================================
  // COMPLIANCE & REGULATIONS
  // ==========================================

  app.get('/api/compliance', (_req: Request, res: Response) => {
    res.json(db.regulations);
  });

  app.put('/api/compliance/:id', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role !== 'superadmin' && currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Nemate ovlaštenje za verifikaciju zakonske usklađenosti.' });
    }

    const index = db.regulations.findIndex((r) => r.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ error: 'Propis nije pronađen.' });
    }

    db.regulations[index] = {
      ...db.regulations[index],
      ...req.body,
      lastVerifiedAt: new Date().toISOString(),
    };

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'PROPIS_VERIFIKOVAN',
      'ComplianceRegulation',
      req.params.id,
      `Ažuriran status usklađenosti za: ${db.regulations[index].actTitle} (${db.regulations[index].articleReference}) na status '${db.regulations[index].status}'.`,
      req.ip || '127.0.0.1'
    );

    res.json(db.regulations[index]);
  });

  // ==========================================
  // AUDIT LOGS
  // ==========================================

  app.get('/api/audit-logs', (_req: Request, res: Response) => {
    res.json(db.auditLogs);
  });

  // ==========================================
  // SCHOOL SETTINGS
  // ==========================================

  app.get('/api/school-settings', (_req: Request, res: Response) => {
    res.json(db.schoolSettings);
  });

  app.put('/api/school-settings', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    if (currentUser.role !== 'superadmin') {
      return res.status(403).json({ error: 'Samo direktor može mijenjati matične postavke škole.' });
    }

    db.schoolSettings = {
      ...db.schoolSettings,
      ...req.body,
    };

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'POSTAVKE_AŽURIRANE',
      'SchoolSettings',
      'settings',
      `Izmijenjene matične postavke škole i prag prolaznosti (${db.schoolSettings.passingThresholdPercent}%).`,
      req.ip || '127.0.0.1'
    );

    res.json(db.schoolSettings);
  });

  // ==========================================
  // VITE DEV SERVER OR STATIC SERVING
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Eksterna Matura Server] Pokrenut na http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Greška pri pokretanju servera:', err);
  process.exit(1);
});
