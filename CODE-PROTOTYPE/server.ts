import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './src/server/db.ts';
import { queryKnowledgeBase, IDSS_KNOWLEDGE_DOCUMENTS } from './src/server/knowledgeBase.ts';
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

  // ==========================================
  // AI TUTOR & PERSONALIZED LEARNING PLAN
  // ==========================================

  app.get('/api/student/learning-plan', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const studentId = (req.query.studentId as string) || currentUser.id;
    const plan = db.getOrCreateLearningPlan(studentId);
    res.json(plan);
  });

  app.post('/api/student/learning-plan/generate', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const studentId = req.body.studentId || currentUser.id;
    const plan = db.generateStudentLearningPlan(studentId);

    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'AI_PLAN_UCENJA_GENERISAN',
      'StudentLearningPlan',
      plan.id,
      `AI Tutor generisao personalizovani plan učenja za učenika ${plan.studentName} na bazi analize ${plan.simulationsAnalyzedCount} simulacija.`,
      req.ip || '127.0.0.1'
    );

    res.status(201).json(plan);
  });

  app.patch('/api/student/learning-plan/step', (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const { moduleId, stepId, studentId } = req.body;
    const targetStudentId = studentId || currentUser.id;

    const updatedPlan = db.togglePlanActionStep(targetStudentId, moduleId, stepId);
    if (!updatedPlan) {
      return res.status(404).json({ error: 'Modul ili korak plana učenja nije pronađen.' });
    }

    res.json(updatedPlan);
  });

  app.post('/api/student/ai-tutor/chat', async (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const { message, topic, currentQuestionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Poruka za AI Tutora je obavezna.' });
    }

    // Try Gemini if API key is present
    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY_1 ||
      process.env.VITE_GEMINI_API_KEY;

    let responseText = '';
    let formulaBox = '';

    if (apiKey) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `Ti si stručni AI Tutor za učenike devetog (IX) razreda osnovne škole u školi Internationale Deutsche Schule Sarajevo (IDSS).
Pripremaš učenika za eksternu maturu (predmeti: Matematika, B/H/S jezik i književnost, Njemački jezik DSD I, Engleski jezik, Fizika).
Odgovaraj isključivo na bosanskom jeziku, s jasnim metodičkim pristupom, pedagoškom podrškom i bez suvišnih fraza.
Objasni pravilo korak po korak, istakni gdje učenici najčešće griješe na ispitima eksterne mature i navedi tačnu formulu ili pravilo.`;

        const prompt = `Učenik postavlja pitanje u vezi ispitne materije: "${message}". ${topic ? `Kontekst teme: ${topic}.` : ''} Objasni metodički i jednostavno sa primjerom.`;

        const geminiRes = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        });

        responseText = geminiRes.text || '';
      } catch (err) {
        console.warn('[AI Tutor] Gemini API poziv nije uspio, prelazak na metodički fallback:', err);
      }
    }

    // High-quality pedagogical fallback if no API key or network error
    if (!responseText) {
      const lower = message.toLowerCase();

      if (lower.includes('jednačin') || lower.includes('razlom') || lower.includes('zagrad') || lower.includes('algebr')) {
        responseText = `Kod rješavanja linearnih jednačina sa razlomcima i zagradama (npr. (x - 1)/2 - (x + 3)/4 = 1), primijeni sljedeća 3 koraka:
1. Pronađi najmanji zajednički sadržalac (NZS) za sve imenioce (u ovom slučaju NZS(2, 4) = 4) i pomnoži cijelu jednačinu s tim brojem.
2. Posebno pazi na predznak MINUS ispred razlomka: kada skratiš 4 sa 4, ostaje -(x + 3), što postaje -x - 3! Ovo je najčešća ispitna greška.
3. Grupiši nepoznate na lijevu stranu, a poznate brojeve na desnu stranu znaka jednakosti.`;
        formulaBox = 'NZS · [ (x - 1)/2 - (x + 3)/4 ] = NZS · 1  ⇒  2(x - 1) - (x + 3) = 4';
      } else if (lower.includes('valjak') || lower.includes('kupa') || lower.includes('tijel') || lower.includes('zapremin') || lower.includes('geometr')) {
        responseText = `Za obla geometrijska tijela (valjak i kupa) na eksternoj maturi uvijek upamti osnovnu razliku:
• Valjak ima dvije paralelne baze (krugove) i omotač koji se razvija u pravougaonik (visina H i dužina 2rπ).
• Zapremina valjka je jednaka površini baze pomnoženoj sa visinom: V = B · H = r²πH.
• Kupa ima samo jednu bazu i vrh, pa je njena zapremina tačno TREĆINA zapremine valjka iste baze i visine: V = (r²πH) / 3.
• Veza elemenata kod kupe (Pitagorina teorema): s² = r² + H², gdje je s izvodnica kupe.`;
        formulaBox = 'Valjak: V = r²πH, P = 2rπ(r + H)  |  Kupa: V = (r²πH) / 3, s² = r² + H²';
      } else if (lower.includes('fizik') || lower.includes('rad') || lower.includes('snag') || lower.includes('ohm') || lower.includes('otpor')) {
        responseText = `U zadacima iz fizike za IX razred najvažnije je uskladiti mjerne jedinice prije uvrštavanja u formulu:
1. Mehanički rad (A): A = F · s. Ako tijelo dižemo vertikalno uvis stalnom brzinom, sila je jednaka težini tijela F_g = m · g (uzmi g ≈ 10 m/s²). Jedinica je džul [J].
2. Mehanička snaga (P): P = A / t. Snaga mjeri koliko se rada izvrši u jednoj sekundi. Vrijeme uvijek pretvori u sekunde! Jedinica je vat [W].
3. Ohmov zakon: Jačina električne struje direktno je proporcionalna naponu, a obrnuto proporcionalna električnom otporu: I = U / R.`;
        formulaBox = 'A = m · g · h [J]  |  P = A / t [W]  |  I = U / R [A]  |  R_serija = R₁ + R₂';
      } else if (lower.includes('glagol') || lower.includes('aorist') || lower.includes('potencijal') || lower.includes('kondicional')) {
        responseText = `U maternjem jeziku (B/H/S) glagolski oblici se dijele na lične (proste i složene) i nelične:
• Potencijal I (kondicional I) je složen glagolski oblik koji izražava mogućnost ili želju: aorist pomoćnog glagola BITI (bih, bi, bi, bismo, biste, bi) + radni glagolski pridjev (npr. ja bih učio, mi bismo došli).
• Aorist je prosto prošlo svršeno vrijeme (npr. rekoh, uradih, pade).
• Zapamti pravilo za 1. lice množine potencijala: pravilno je samo "bismo uradili", nikada "bi uradili"!`;
        formulaBox = 'Potencijal I = [bih, bi, bi, bismo, biste, bi] + radni glagolski pridjev (glagol na -o/-la/-lo)';
      } else if (lower.includes('njemač') || lower.includes('deutsch') || lower.includes('dsd') || lower.includes('weil') || lower.includes('perfekt')) {
        responseText = `Za polaganje njemačkog jezika (DSD I nivo A2/B1 na IDSS):
1. Zavisne rečenice sa WEIL, DASS, WENN: Veznik uvijek šalje konjugovani glagol na sam kraj rečenice (npr. "Ich lerne viel, weil ich die Prüfung bestehen will.").
2. Perfekt sa SEIN: Koristi se kod glagola kretanja iz tačke A u B (fahren, fliegen, gehen, laufen), promjene stanja (aufwachen, einschlafen) i glagola sein i bleiben.
3. Kod modalnih glagola u prezentu (können, müssen, dürfen, wollen): modalni glagol stoji na 2. poziciji, a infinitiv glavnog glagola na kraju.`;
        formulaBox = 'KICK-pravilo: Hauptsatz + weil + Subjekt + ... + konjugiertes Verb am Satzende!';
      } else {
        responseText = `Kao tvoj IDSS AI Tutor, analizirao sam tvoje ispitne simulacije i preporučujem ti fokus na tri ključna pravila za eksternu maturu:
1. U matematici uvijek prvo pojednostavi izraz prije nego kreneš u računanje.
2. Kod zadataka s višestrukim izborom koristi metodu eliminacije: odmah odbaci 2 očito netačna odgovora.
3. Nakon rješavanja zadatka, uvijek uvrsti rezultat nazad i provjeri da li je realan i smislen.
Postavi mi bilo koje konkretno pitanje u vezi zadatka, formule ili gramatičkog pravila i objasniću ti korak po korak!`;
      }
    }

    res.json({
      id: 'msg-' + Date.now(),
      sender: 'tutor',
      text: responseText,
      timestamp: new Date().toISOString(),
      relatedTopic: topic,
      formulaBox: formulaBox || undefined,
    });
  });

  // ==========================================
  // GEMINI MULTI-TURN CHATBOT ENDPOINTS
  // ==========================================

  const GEMINI_ROLES = [
    {
      id: 'matura-general',
      name: 'IDSS Matura Asistent (Opšti)',
      shortTitle: 'Opšti asistent',
      description: 'Stručna priprema za eksternu maturu IX razreda prema standardima Kantona Sarajevo i IDSS kurikulumu.',
      systemInstruction: `Ti si zvanični IDSS AI Asistent za učenike devetog (IX) razreda i nastavnike škole Internationale Deutsche Schule Sarajevo.
Tvoj zadatak je priprema učenika za eksternu maturu iz svih predmeta (Matematika, B/H/S jezik, Njemački jezik DSD I, Engleski jezik, Fizika).
Odgovaraj isključivo na bosanskom jeziku. Budi jasan, metodički precizan, podržavajući i konkretan.
Kada objašnjavaš, koristi strukturirane korake, istakni ključne formule ili pravila, i upozori na česte ispitne zamke.`,
      suggestedPrompts: [
        'Koji je prag prolaznosti na eksternoj maturi i kako se boduje?',
        'Daj mi 3 najvažnija savjeta za pripremu ispita iz matematike.',
        'Koje su najčešće greške učenika na eksternoj maturi?',
      ],
    },
    {
      id: 'matematika',
      name: 'Matematički mentor',
      shortTitle: 'Matematika',
      description: 'Rješavanje linearnih jednačina, geometrije, Pitagorine teoreme, obrtnih tijela i procenata.',
      systemInstruction: `Ti si viši nastavnik matematike za deveti razred u školi Internationale Deutsche Schule Sarajevo (IDSS).
Pomažeš učenicima u savladavanju ispitnih zadataka: linearne jednačine i nejednačine sa razlomcima, Pitagorina teorema, geometrijska tijela (valjak, kupa, prizma, lopta), procenti i proporcije.
Uvijek prikaži jasan postupak korak-po-korak. Istakni formule i upozori na promjenu predznaka ispred zagrada.`,
      suggestedPrompts: [
        'Kako se rješava jednačina sa razlomcima kada je minus ispred?',
        'Koja je formula za zapreminu i omotač valjka i kupe?',
        'Objasni primjenu Pitagorine teoreme na jednakokrakom trouglu.',
      ],
    },
    {
      id: 'jezici',
      name: 'Jezički savjetnik (B/H/S & Deutsch DSD I)',
      shortTitle: 'Jezici & DSD I',
      description: 'Morfologija, glagolski oblici, pravopis B/H/S jezika, te DSD I priprema za njemački jezik.',
      systemInstruction: `Ti si profesor jezika za B/H/S (Bosanski, hrvatski, srpski jezik i književnost) i Njemački jezik (priprema za DSD I - Deutsches Sprachdiplom, nivo A2/B1) u školi IDSS.
Pomažeš sa glagolskim oblicima (aorist, perfekat, potencijal I), zavisnim rečenicama, glasovnim promjenama, te njemačkom sintaksom (veznici weil, dass, wenn - Kick-pravilo).`,
      suggestedPrompts: [
        'Koja je razlika između aorista i potencijala I?',
        'Objasni Kick-pravilo za red riječi u njemačkim zavisnim rečenicama sa weil.',
        'Koje su najčešće glasovne promjene u B/H/S jeziku na maturi?',
      ],
    },
    {
      id: 'fizika',
      name: 'Fizika & Prirodne nauke',
      shortTitle: 'Fizika',
      description: 'Mehanički rad i snaga, pritisak u fluidima, Arhimedov zakon i Ohmov zakon.',
      systemInstruction: `Ti si nastavnik fizike za IX razred osnovne škole u IDSS.
Pomažeš učenicima u razumijevanju fizikalnih zakona, računanju rada (A = F·s), snage (P = A/t) i električne struje (I = U/R).
Uvijek naglasi pretvaranje u osnovne mjerne jedinice SI sistema (džul, vat, amper, volt, om) prije računanja.`,
      suggestedPrompts: [
        'Kako se računa rad pri vertikalnom dizanju tereta mase m na visinu h?',
        'Kako glasi Ohmov zakon za dio strujnog kola i koje su jedinice?',
        'Objasni Arhimedov zakon i uslov plivanja tijela.',
      ],
    },
  ];

  // Rate limiter for RAG Chatbot: max 20 messages per user per hour
  const chatRateLimiter = new Map<string, { count: number; windowStart: number }>();

  app.get('/api/gemini/roles', (_req: Request, res: Response) => {
    res.json(GEMINI_ROLES);
  });

  app.get('/api/gemini/knowledge-base', (_req: Request, res: Response) => {
    const totalChunks = IDSS_KNOWLEDGE_DOCUMENTS.reduce((acc, d) => acc + d.chunks.length, 0);
    res.json({
      totalDocuments: IDSS_KNOWLEDGE_DOCUMENTS.length,
      totalChunks,
      documents: IDSS_KNOWLEDGE_DOCUMENTS.map((d) => ({
        id: d.id,
        code: d.code,
        title: d.title,
        category: d.category,
        authority: d.authority,
        effectiveDate: d.effectiveDate,
        documentStatus: d.documentStatus,
        chunksCount: d.chunks.length,
      })),
    });
  });

  app.post('/api/gemini/chat', async (req: Request, res: Response) => {
    const currentUser = getAuthUser(req);
    const { message, history = [], model = 'gemini-2.5-flash', roleId = 'matura-general' } = req.body;

    // 1. Validate user message (Section 16 Step 1)
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Poruka je obavezna i ne smije biti prazna.' });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        error: 'Poruka je predugačka. Maksimalna dozvoljena dužina iznosi 2.000 karaktera.',
      });
    }

    // 2. Rate limiting: max 20 messages per user per hour (Section 16 Step 2)
    const now = Date.now();
    const userLimit = chatRateLimiter.get(currentUser.id) || { count: 0, windowStart: now };
    if (now - userLimit.windowStart > 3600000) {
      userLimit.count = 0;
      userLimit.windowStart = now;
    }
    if (userLimit.count >= 20) {
      return res.status(429).json({
        error:
          'Prekoračen je dozvoljeni limit od 20 poruka po korisniku u roku od 1 sat. Molimo sačekajte prije slanja novog upita.',
      });
    }
    userLimit.count += 1;
    chatRateLimiter.set(currentUser.id, userLimit);

    const selectedRole = GEMINI_ROLES.find((r) => r.id === roleId) || GEMINI_ROLES[0];

    // 3. Execute Hybrid RAG Retrieval against active USTAV chunks only (Section 16 Step 3, 4, 5, 6)
    const ragResult = queryKnowledgeBase(message.trim());

    // 4. LOW CONFIDENCE CHECK: If no chunk has cosine similarity >= 0.75, strictly do NOT call generation model (Section 15 & 16 Step 6-7)
    if (ragResult.isRefusal || ragResult.confidence === 'LOW') {
      db.addAuditLog(
        currentUser.id,
        currentUser.email,
        currentUser.role,
        'CHATBOT_RAG_REFUSAL',
        'KnowledgeBaseQuery',
        'refusal-' + Date.now(),
        `Odbijen upit - niska pouzdanost (Max sličnost: ${(ragResult.maxScore * 100).toFixed(1)}% < 75%). Korisnik: ${currentUser.fullName}, Poruka: "${message.slice(0, 80)}"`,
        (req.ip as string) || '127.0.0.1'
      );

      return res.json({
        id: 'gemini-refusal-' + Date.now(),
        role: 'model',
        text: ragResult.refusalMessage,
        modelUsed: 'rag-knowledge-base',
        roleId: selectedRole.id,
        confidence: 'LOW',
        similarityScore: ragResult.maxScore,
        retrievedChunks: [],
        isRefusal: true,
        timestamp: new Date().toISOString(),
      });
    }

    // 5. HIGH CONFIDENCE: Construct system prompt strictly grounded in USTAV (Section 16 Step 8)
    const ragSystemPrompt = `Ti si IDSS Asistent, profesionalni institucionalni asistent za nastavnike i zaposlenike
P.U. Internationale Deutsche Schule Sarajevo.

Odgovaraš isključivo na bosanskom jeziku, bez iznimke.
Tvoji odgovori su precizni, profesionalni i direktni.
Nikada ne koristiš fraze poput "naravno", "svakako", "sjajno pitanje", "razumijem" ili slične.

Sve informacije koje daješ moraju biti zasnovane isključivo na sljedećim dokumentima USTAV-a škole:

[CONTEXT:
${ragResult.formattedContext}
]

Ako informacija nije jasno i direktno podržana gore navedenim dokumentima, ne izmišljaj odgovor.
Umjesto toga, uputite korisnika direktoru škole.`;

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY_1 ||
      process.env.VITE_GEMINI_API_KEY;

    // Model selection preference
    const allowedModels = ['gemini-2.5-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview'];
    const chosenModel = allowedModels.includes(model) ? model : 'gemini-2.5-flash';

    let generatedText = '';

    if (apiKey) {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        // Build conversation history contents
        const contents = [];
        if (Array.isArray(history)) {
          history.slice(-8).forEach((h: { role: string; text: string }) => {
            if (h.text && (h.role === 'user' || h.role === 'model')) {
              contents.push({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.text }],
              });
            }
          });
        }

        contents.push({
          role: 'user',
          parts: [{ text: message.trim() }],
        });

        const geminiRes = await ai.models.generateContent({
          model: chosenModel,
          contents,
          config: {
            systemInstruction: ragSystemPrompt,
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        });

        generatedText = geminiRes.text || '';
      } catch (err) {
        console.warn('[Gemini RAG Chatbot] API poziv nije uspio, generisanje direktno iz verifikovanih izvora:', err);
      }
    }

    // High-fidelity fallback strictly extracted from top verified RAG chunks
    if (!generatedText) {
      const topChunk = ragResult.retrievedChunks[0];
      const additionalChunks = ragResult.retrievedChunks.slice(1, 3);
      
      generatedText = `${topChunk.text}\n\n`;
      if (additionalChunks.length > 0) {
        generatedText += `Dodatne odredbe iz internih dokumenata:\n` + additionalChunks.map(c => `• ${c.article}: ${c.text.split('\n')[0]}`).join('\n') + `\n\n`;
      }
      generatedText += `[Izvor: ${topChunk.documentTitle} - ${topChunk.article}]`;
    }

    // 6. Record conversation turn & audit trail in database (Section 16 Step 9)
    db.addAuditLog(
      currentUser.id,
      currentUser.email,
      currentUser.role,
      'CHATBOT_RAG_RESPONSE',
      'KnowledgeBaseQuery',
      'rag-reply-' + Date.now(),
      `Uspješan RAG odgovor (Sličnost: ${(ragResult.maxScore * 100).toFixed(1)}%). Izvori: ${ragResult.retrievedChunks.map((c) => c.documentTitle).join(', ')}`,
      (req.ip as string) || '127.0.0.1'
    );

    res.json({
      id: 'gemini-reply-' + Date.now(),
      role: 'model',
      text: generatedText,
      modelUsed: apiKey ? chosenModel : 'idss-ustav-rag',
      roleId: selectedRole.id,
      confidence: 'HIGH',
      similarityScore: ragResult.maxScore,
      retrievedChunks: ragResult.retrievedChunks.map((c) => ({
        id: c.id,
        documentId: c.documentId,
        documentTitle: c.documentTitle,
        article: c.article,
        text: c.text,
        score: c.score,
      })),
      isRefusal: false,
      timestamp: new Date().toISOString(),
    });
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
