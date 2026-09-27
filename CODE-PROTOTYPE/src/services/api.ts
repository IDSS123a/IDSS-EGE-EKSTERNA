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
  StudentBadgeSummary,
  StudentBadge,
  StudentPracticeActivity,
  StudentLearningPlan,
  AITutorChatMessage,
  GeminiChatMessage,
  GeminiChatRole,
} from '../types/index.ts';

class ApiService {
  private currentUserId: string = 'user-admin-pedagog'; // default admin for review

  setCurrentUserId(id: string) {
    this.currentUserId = id;
  }

  getCurrentUserId(): string {
    return this.currentUserId;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-user-id': this.currentUserId,
    };
  }

  // Auth
  async login(email: string, password?: string): Promise<{ token: string; user: User }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Neuspješna prijava.');
    }
    const data = await res.json();
    this.currentUserId = data.user.id;
    return data;
  }

  async register(userData: Partial<User>): Promise<{ token: string; user: User }> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Neuspješna registracija.');
    }
    const data = await res.json();
    this.currentUserId = data.user.id;
    return data;
  }

  async getCurrentUser(): Promise<User> {
    const res = await fetch('/api/auth/me', { headers: this.getHeaders() });
    return res.json();
  }

  async getUsers(): Promise<User[]> {
    const res = await fetch('/api/users', { headers: this.getHeaders() });
    return res.json();
  }

  async updateUserRole(id: string, role: string): Promise<User> {
    const res = await fetch(`/api/users/${id}/role`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ role }),
    });
    return res.json();
  }

  async updateUserStatus(id: string, status: string): Promise<User> {
    const res = await fetch(`/api/users/${id}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    return res.json();
  }

  // Categories & Tags
  async getCategories(subjectId?: string): Promise<QuestionCategory[]> {
    const query = subjectId ? `?subjectId=${subjectId}` : '';
    const res = await fetch(`/api/categories${query}`, { headers: this.getHeaders() });
    return res.json();
  }

  async createCategory(data: Partial<QuestionCategory>): Promise<QuestionCategory> {
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Greška pri kreiranju kategorije.');
    }
    return res.json();
  }

  async getTags(): Promise<string[]> {
    const res = await fetch('/api/tags', { headers: this.getHeaders() });
    return res.json();
  }

  // Subjects & Questions
  async getSubjects(): Promise<Subject[]> {
    const res = await fetch('/api/subjects', { headers: this.getHeaders() });
    return res.json();
  }

  async getQuestions(params?: {
    subjectId?: string;
    categoryId?: string;
    categoryName?: string;
    tag?: string;
    difficulty?: string;
    domain?: string;
    search?: string;
  }): Promise<Question[]> {
    const query = new URLSearchParams();
    if (params?.subjectId) query.set('subjectId', params.subjectId);
    if (params?.categoryId) query.set('categoryId', params.categoryId);
    if (params?.categoryName) query.set('categoryName', params.categoryName);
    if (params?.tag) query.set('tag', params.tag);
    if (params?.difficulty) query.set('difficulty', params.difficulty);
    if (params?.domain) query.set('domain', params.domain);
    if (params?.search) query.set('search', params.search);

    const res = await fetch(`/api/questions?${query.toString()}`, { headers: this.getHeaders() });
    return res.json();
  }

  async createQuestion(questionData: Partial<Question>): Promise<Question> {
    const res = await fetch('/api/questions', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(questionData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Greška pri kreiranju pitanja.');
    }
    return res.json();
  }

  async updateQuestion(id: string, questionData: Partial<Question>): Promise<Question> {
    const res = await fetch(`/api/questions/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(questionData),
    });
    return res.json();
  }

  async deleteQuestion(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/questions/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  // Exams
  async getExams(): Promise<ExamSession[]> {
    const res = await fetch('/api/exams', { headers: this.getHeaders() });
    return res.json();
  }

  async createExam(examData: Partial<ExamSession>): Promise<ExamSession> {
    const res = await fetch('/api/exams', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(examData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Greška pri kreiranju ispita.');
    }
    return res.json();
  }

  async updateExam(id: string, examData: Partial<ExamSession>): Promise<ExamSession> {
    const res = await fetch(`/api/exams/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(examData),
    });
    return res.json();
  }

  async deleteExam(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/exams/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return res.json();
  }

  async drawPoolPreview(examId: string): Promise<any> {
    const res = await fetch(`/api/exams/${examId}/draw-pool`, { headers: this.getHeaders() });
    return res.json();
  }

  // Simulation & Attempts
  async generateSimulation(subjectId: string): Promise<{ subject: Subject; questions: Question[]; durationMinutes: number }> {
    const res = await fetch(`/api/exams/generate-simulation/${subjectId}`, { headers: this.getHeaders() });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Nije moguće generisati test.');
    }
    return res.json();
  }

  async submitAttempt(subjectId: string, answers: Record<string, string>, durationSeconds: number): Promise<StudentAttempt> {
    const res = await fetch('/api/student/attempts', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ subjectId, answers, durationSeconds }),
    });
    return res.json();
  }

  async getAttempts(studentId?: string): Promise<StudentAttempt[]> {
    const query = studentId ? `?studentId=${studentId}` : '';
    const res = await fetch(`/api/student/attempts${query}`, { headers: this.getHeaders() });
    return res.json();
  }

  async getStudentAnalytics(studentId?: string): Promise<any> {
    const query = studentId ? `?studentId=${studentId}` : '';
    const res = await fetch(`/api/student/analytics${query}`, { headers: this.getHeaders() });
    return res.json();
  }

  // Student Badges & Practice Activity
  async getBadges(studentId?: string): Promise<StudentBadgeSummary> {
    const query = studentId ? `?studentId=${studentId}` : '';
    const res = await fetch(`/api/student/badges${query}`, { headers: this.getHeaders() });
    return res.json();
  }

  async recordPracticeActivity(data: {
    type: 'question_answered' | 'simulation_completed' | 'solution_revealed';
    subjectId?: string;
    questionId?: string;
    isCorrect?: boolean;
  }): Promise<{
    activity: StudentPracticeActivity;
    summary: StudentBadgeSummary;
    newlyUnlockedBadges: StudentBadge[];
  }> {
    const res = await fetch('/api/student/practice-activity', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  // AI Tutor & Learning Plan
  async getLearningPlan(studentId?: string): Promise<StudentLearningPlan> {
    const query = studentId ? `?studentId=${studentId}` : '';
    const res = await fetch(`/api/student/learning-plan${query}`, { headers: this.getHeaders() });
    return res.json();
  }

  async generateLearningPlan(studentId?: string): Promise<StudentLearningPlan> {
    const res = await fetch('/api/student/learning-plan/generate', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ studentId }),
    });
    return res.json();
  }

  async togglePlanActionStep(
    moduleId: string,
    stepId: string,
    studentId?: string
  ): Promise<StudentLearningPlan> {
    const res = await fetch('/api/student/learning-plan/step', {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ moduleId, stepId, studentId }),
    });
    return res.json();
  }

  async sendAITutorMessage(
    message: string,
    topic?: string,
    currentQuestionId?: string
  ): Promise<AITutorChatMessage> {
    const res = await fetch('/api/student/ai-tutor/chat', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ message, topic, currentQuestionId }),
    });
    return res.json();
  }

  // Gemini Multi-Turn Chat & RAG
  async getGeminiRoles(): Promise<GeminiChatRole[]> {
    const res = await fetch('/api/gemini/roles', { headers: this.getHeaders() });
    return res.json();
  }

  async getKnowledgeBaseOverview(): Promise<{ totalDocuments: number; totalChunks: number; documents: any[] }> {
    const res = await fetch('/api/gemini/knowledge-base', { headers: this.getHeaders() });
    return res.json();
  }

  async sendGeminiChatMessage(data: {
    message: string;
    history?: Array<{ role: 'user' | 'model'; text: string }>;
    model?: string;
    roleId?: string;
  }): Promise<GeminiChatMessage> {
    const res = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  // Admin Monitoring & Accommodations
  async getAdminOverview(): Promise<any> {
    const res = await fetch('/api/admin/overview', { headers: this.getHeaders() });
    return res.json();
  }

  async getAccommodations(): Promise<StudentAccommodation[]> {
    const res = await fetch('/api/admin/accommodations', { headers: this.getHeaders() });
    return res.json();
  }

  async createAccommodation(data: Partial<StudentAccommodation>): Promise<StudentAccommodation> {
    const res = await fetch('/api/admin/accommodations', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  // Documents
  async getDocuments(): Promise<GeneratedDocument[]> {
    const res = await fetch('/api/documents', { headers: this.getHeaders() });
    return res.json();
  }

  async generateDocument(documentType: string, title: string, metadata: any): Promise<GeneratedDocument> {
    const res = await fetch('/api/documents/generate', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ documentType, title, metadata }),
    });
    return res.json();
  }

  // Compliance
  async getCompliance(): Promise<ComplianceRegulation[]> {
    const res = await fetch('/api/compliance', { headers: this.getHeaders() });
    return res.json();
  }

  async updateCompliance(id: string, data: Partial<ComplianceRegulation>): Promise<ComplianceRegulation> {
    const res = await fetch(`/api/compliance/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return res.json();
  }

  // Audit Logs
  async getAuditLogs(): Promise<AuditLog[]> {
    const res = await fetch('/api/audit-logs', { headers: this.getHeaders() });
    return res.json();
  }

  // Settings
  async getSchoolSettings(): Promise<SchoolSettings> {
    const res = await fetch('/api/school-settings', { headers: this.getHeaders() });
    return res.json();
  }

  async updateSchoolSettings(settings: Partial<SchoolSettings>): Promise<SchoolSettings> {
    const res = await fetch('/api/school-settings', {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(settings),
    });
    return res.json();
  }
}

export const api = new ApiService();
