import React, { useEffect, useState } from 'react';
import {
  User,
  StudentLearningPlan,
  WeaknessTopicAnalysis,
  StudyModulePlan,
  Question,
  AITutorChatMessage,
} from '../../types/index.ts';
import { api } from '../../services/api.ts';
import {
  Brain,
  Sparkles,
  Target,
  Calendar,
  CheckCircle2,
  Circle,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  BookOpen,
  MessageSquare,
  HelpCircle,
  Send,
  Check,
  ChevronRight,
  TrendingUp,
  Clock,
  Layers,
  FileQuestion,
  X,
  Play,
  Flame,
} from 'lucide-react';

interface AITutorProps {
  currentUser: User;
  onOpenPractice?: (subjectId?: string) => void;
  onStartSimulation?: (subjectId: string) => void;
}

export const AITutor: React.FC<AITutorProps> = ({
  currentUser,
  onOpenPractice,
  onStartSimulation,
}) => {
  const [plan, setPlan] = useState<StudentLearningPlan | null>(null);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'plan' | 'weaknesses' | 'chat'>('plan');

  // Interactive Question Modal State
  const [activeQuestion, setActiveQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showAnswerResult, setShowAnswerResult] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState<AITutorChatMessage[]>([
    {
      id: 'init-msg',
      sender: 'tutor',
      text: 'Pozdrav! Ja sam tvoj IDSS AI Tutor. Analizirao sam tvoje ispitne simulacije i pripremio personalizovani 5-dnevni plan učenja usmjeren na tvoje najčešće greške. Kako ti mogu pomoći danas?',
      timestamp: new Date().toISOString(),
      formulaBox: 'Linearne jednačine · Obla geometrijska tijela · Fizika (Mehanika) · DSD I gramatika',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [planData, questionsData] = await Promise.all([
          api.getLearningPlan(currentUser.id),
          api.getQuestions(),
        ]);
        setPlan(planData);
        setAllQuestions(questionsData);
      } catch (err) {
        console.error('Greška pri učitavanju AI Tutora:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser.id]);

  const handleRegeneratePlan = async () => {
    try {
      setRegenerating(true);
      const newPlan = await api.generateLearningPlan(currentUser.id);
      setPlan(newPlan);
    } catch (err) {
      console.error('Greška pri regeneraciji plana učenja:', err);
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleStep = async (moduleId: string, stepId: string) => {
    try {
      const updated = await api.togglePlanActionStep(moduleId, stepId, currentUser.id);
      setPlan(updated);
    } catch (err) {
      console.error('Greška pri označavanju koraka:', err);
    }
  };

  const handleOpenQuestionModal = (qId: string) => {
    const q = allQuestions.find((item) => item.id === qId);
    if (q) {
      setActiveQuestion(q);
      setSelectedOption(null);
      setShowAnswerResult(false);
    }
  };

  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = presetText || chatInput;
    if (!textToSend.trim() || chatLoading) return;

    const userMsg: AITutorChatMessage = {
      id: 'user-msg-' + Date.now(),
      sender: 'student',
      text: textToSend,
      timestamp: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!presetText) setChatInput('');
    setChatLoading(true);

    try {
      const reply = await api.sendAITutorMessage(textToSend);
      setChatMessages((prev) => [...prev, reply]);
    } catch (err) {
      console.error('Greška u komunikaciji s AI Tutorom:', err);
      setChatMessages((prev) => [
        ...prev,
        {
          id: 'err-msg-' + Date.now(),
          sender: 'tutor',
          text: 'Trenutno ne mogu obraditi upit. Molimo pokušajte ponovo ili odaberite neku od preporučenih tema.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-500">
        <Brain className="w-10 h-10 text-indigo-500 animate-pulse" />
        <span className="text-sm font-medium">AI Tutor analizira ispitne obrasce i simulacije...</span>
      </div>
    );
  }

  const progressPercent =
    plan && plan.totalActionStepsCount > 0
      ? Math.round((plan.completedActionStepsCount / plan.totalActionStepsCount) * 100)
      : 0;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Top Banner: Institutional AI Diagnostics & Forecast */}
      <div className="relative rounded-2xl overflow-hidden border border-indigo-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Brain className="w-3.5 h-3.5" />
                IDSS AI Tutor · Individualni kurikulum
              </span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-amber-300 font-mono">
                {plan?.simulationsAnalyzedCount ?? 0} simulacija analizirano
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Personalizovani plan pripreme: {currentUser.fullName}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {plan?.overallSummary ||
                'Sistem je analizirao tvoje odgovore na probnim simulacijama eksterne mature i izradio ciljani plan učenja koji targetira uočene propuste u gradivu devetog razreda.'}
            </p>

            <div className="pt-1 flex items-center gap-2 text-xs text-amber-200 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl max-w-xl">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{plan?.motivationalTip}</span>
            </div>
          </div>

          {/* Right Forecast Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-5 rounded-2xl shrink-0 lg:w-72 space-y-4">
            <div>
              <div className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                Prognoza rezultata na maturi
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-extrabold font-mono text-emerald-400">
                  {plan?.overallMaturaScoreForecast ?? 88}%
                </span>
                <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  +{plan?.projectedReadinessIncrease ?? 18}% rasta
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Nakon realizacije svih 5 modula plana
              </p>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300">Napredak plana:</span>
                <span className="font-mono font-bold text-white">
                  {plan?.completedActionStepsCount}/{plan?.totalActionStepsCount} ({progressPercent}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-400 to-emerald-400 rounded-full transition-all duration-700"
                  style={{ width: `${Math.max(progressPercent, 5)}%` }}
                />
              </div>
            </div>

            <button
              onClick={handleRegeneratePlan}
              disabled={regenerating}
              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer border border-white/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              <span>{regenerating ? 'Analiziranje...' : 'Osvježi analizu simulacija'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('plan')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'plan'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>5-dnevni plan učenja ({plan?.modules.length ?? 0} modula)</span>
        </button>

        <button
          onClick={() => setActiveTab('weaknesses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'weaknesses'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Analiza slabih tačaka ({plan?.weaknesses.length ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'chat'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>AI Tutor Asistent (Chat)</span>
        </button>
      </div>

      {/* TAB 1: 5-DAY STUDY MODULES */}
      {activeTab === 'plan' && plan && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ciljani nastavni moduli po danima
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Svaki dan targetira specifičnu slabost sa sažetim formulama, zamkama i zadacima iz baze
              </p>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Ukupno preporučenih zadataka: <strong className="text-indigo-600">{plan.totalRecommendedQuestionsCount}</strong>
            </div>
          </div>

          <div className="space-y-5">
            {plan.modules.map((mod) => (
              <div
                key={mod.id}
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  mod.isCompleted ? 'border-emerald-300 shadow-2xs' : 'border-slate-200 shadow-2xs hover:border-slate-300'
                }`}
              >
                {/* Module Header Bar */}
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                        mod.isCompleted
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      }`}
                    >
                      {mod.isCompleted ? '✓' : `D${mod.dayNumber}`}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{mod.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-semibold text-slate-700">{mod.subjectName}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {mod.estimatedMinutes} min
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {mod.isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Modul završen
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        U toku
                      </span>
                    )}
                  </div>
                </div>

                {/* Module Content */}
                <div className="p-6 space-y-6">
                  {/* Grid: Key Concepts & Common Traps */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-indigo-50/40 border border-indigo-100 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                        <Target className="w-4 h-4 text-indigo-600" />
                        <span>Ključni koncepti i formule za maturu</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-700">
                        {mod.keyConcepts.map((kc, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-indigo-500 font-bold">•</span>
                            <span className="leading-relaxed">{kc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>Česte ispitne zamke (Upozorenje)</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-amber-950">
                        {mod.commonTraps.map((trap, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-amber-600 font-bold">⚠️</span>
                            <span className="leading-relaxed">{trap}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Action Steps Checklist */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Pedagoški koraci za realizaciju (Označi po završetku):
                    </div>
                    <div className="space-y-2">
                      {mod.actionSteps.map((step) => (
                        <div
                          key={step.id}
                          onClick={() => handleToggleStep(mod.id, step.id)}
                          className={`p-3 rounded-xl border flex items-center gap-3 transition-colors cursor-pointer select-none ${
                            step.isDone
                              ? 'bg-emerald-50/50 border-emerald-200 text-slate-800'
                              : 'bg-white border-slate-200 hover:bg-slate-50/80 text-slate-800'
                          }`}
                        >
                          <div className="shrink-0">
                            {step.isDone ? (
                              <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                            ) : (
                              <Circle className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          <span
                            className={`text-xs flex-1 ${
                              step.isDone ? 'line-through text-slate-500' : 'font-medium text-slate-900'
                            }`}
                          >
                            {step.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommended Questions from Bank */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        Preporučena ispitna pitanja iz baze:
                      </span>
                      {onOpenPractice && (
                        <button
                          onClick={() => onOpenPractice(mod.subjectId)}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                        >
                          Vježbaj čitav predmet →
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {mod.recommendedQuestionIds.map((qId) => {
                        const q = allQuestions.find((item) => item.id === qId);
                        if (!q) return null;
                        return (
                          <div
                            key={q.id}
                            className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-indigo-300 transition-all space-y-2 flex flex-col justify-between"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-mono font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  {q.topic}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    q.difficulty === 'advanced'
                                      ? 'bg-rose-100 text-rose-800'
                                      : q.difficulty === 'intermediate'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {q.difficulty}
                                </span>
                              </div>
                              <p className="text-xs text-slate-800 line-clamp-2 font-medium">
                                {q.questionText}
                              </p>
                            </div>

                            <button
                              onClick={() => handleOpenQuestionModal(q.id)}
                              className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors cursor-pointer"
                            >
                              <Play className="w-3 h-3 fill-indigo-700" />
                              <span>Riješi zadatak</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: DETAILED WEAKNESS DIAGNOSTICS */}
      {activeTab === 'weaknesses' && plan && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Dijagnostika slabih tačaka učenika
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Analiza netačnih odgovora na probnim ispitima sa pedagoškim smjernicama za otklanjanje nesigurnosti
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {plan.weaknesses.map((w, idx) => {
              const severityBadge =
                w.severity === 'high'
                  ? { label: 'Visok prioritet', color: 'bg-rose-100 text-rose-800 border-rose-200' }
                  : w.severity === 'medium'
                  ? { label: 'Srednji prioritet', color: 'bg-amber-100 text-amber-800 border-amber-200' }
                  : { label: 'Praćenje', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };

              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {w.subjectName}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                          {w.topic}
                        </h3>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${severityBadge.color}`}>
                        {severityBadge.label}
                      </span>
                    </div>

                    {/* Accuracy rate progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Uspješnost na zadacima:</span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {w.accuracyRate}% ({w.totalQuestionsEncountered - w.incorrectCount}/{w.totalQuestionsEncountered} tačno)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            w.accuracyRate < 50
                              ? 'bg-rose-500'
                              : w.accuracyRate < 75
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(w.accuracyRate, 6)}%` }}
                        />
                      </div>
                    </div>

                    {/* Identified Issue */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                      <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Uočena ispitna prepreka:</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {w.identifiedIssue}
                      </p>
                    </div>

                    {/* Pedagogical Advice */}
                    <div className="p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-1">
                      <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Preporučeni pedagoški savjet:</span>
                      </div>
                      <p className="text-xs text-indigo-950 leading-relaxed">
                        {w.pedagogicalAdvice}
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-500 font-mono">
                      {w.recommendedQuestionIds.length} preporučenih zadataka
                    </span>
                    {w.recommendedQuestionIds[0] && (
                      <button
                        onClick={() => handleOpenQuestionModal(w.recommendedQuestionIds[0])}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                      >
                        <span>Vježbaj uzorak</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: INTERACTIVE AI TUTOR CHAT */}
      {activeTab === 'chat' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-[650px]">
          {/* Chat Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">IDSS AI Tutor Asistent</h3>
                <p className="text-[11px] text-slate-400">
                  Usklađeno sa kurikulumom Kantona Sarajevo i DSD I programom
                </p>
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Aktivno
            </span>
          </div>

          {/* Quick Prompts Strip */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 overflow-x-auto flex items-center gap-2 text-xs">
            <span className="text-slate-500 text-[11px] font-semibold whitespace-nowrap">Brza pitanja:</span>
            {[
              'Kako se rješavaju linearne jednačine sa razlomcima?',
              'Koja je formula za zapreminu valjka i kupe?',
              'Objasni mi razliku aorista i potencijala I',
              'Kako glasi Kick-pravilo u njemačkim zavisnim rečenicama?',
              'Kako se računa mehanički rad pri dizanju tereta?',
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendChatMessage(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-slate-700 transition-colors cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-2xl ${msg.sender === 'student' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    msg.sender === 'student'
                      ? 'bg-slate-800 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {msg.sender === 'student' ? 'U' : <Brain className="w-4 h-4" />}
                </div>

                <div
                  className={`p-4 rounded-2xl text-xs sm:text-sm space-y-2 leading-relaxed ${
                    msg.sender === 'student'
                      ? 'bg-indigo-600 text-white rounded-tr-xs'
                      : 'bg-slate-100 text-slate-900 rounded-tl-xs border border-slate-200/70'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {msg.formulaBox && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-900 text-amber-300 font-mono text-xs border border-slate-800 select-all">
                      💡 {msg.formulaBox}
                    </div>
                  )}

                  <div
                    className={`text-[10px] text-right font-mono ${
                      msg.sender === 'student' ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString('bs', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-3 max-w-xl">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shrink-0">
                  <Brain className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-100 text-slate-500 text-xs italic flex items-center gap-2 border border-slate-200">
                  <span>AI Tutor priprema metodičko objašnjenje...</span>
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center gap-3">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendChatMessage();
              }}
              placeholder="Postavi pitanje AI Tutoru (npr. 'Objasni formulu za pritisak u fluidima')..."
              className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-600"
            />
            <button
              onClick={() => handleSendChatMessage()}
              disabled={!chatInput.trim() || chatLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Pošalji</span>
            </button>
          </div>
        </div>
      )}

      {/* INTERACTIVE QUESTION MODAL */}
      {activeQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                  {activeQuestion.topic}
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs font-mono text-slate-500">
                  {activeQuestion.points} boda ({activeQuestion.difficulty})
                </span>
              </div>
              <button
                onClick={() => setActiveQuestion(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Question Text */}
            <div className="space-y-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                {activeQuestion.questionText}
              </h3>
            </div>

            {/* Answer Options */}
            <div className="space-y-2.5">
              {activeQuestion.options.map((opt) => {
                const isSelected = selectedOption === opt.id;
                const isCorrect = opt.id === activeQuestion.correctOptionId;

                let stateClasses = 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800';
                if (showAnswerResult) {
                  if (isCorrect) {
                    stateClasses = 'bg-emerald-50 border-emerald-500 text-emerald-950 font-semibold';
                  } else if (isSelected && !isCorrect) {
                    stateClasses = 'bg-rose-50 border-rose-500 text-rose-950';
                  }
                } else if (isSelected) {
                  stateClasses = 'bg-indigo-50 border-indigo-600 text-indigo-950 font-semibold';
                }

                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      if (!showAnswerResult) setSelectedOption(opt.id);
                    }}
                    className={`w-full p-3.5 rounded-xl border text-xs sm:text-sm text-left flex items-center justify-between transition-all cursor-pointer ${stateClasses}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 font-bold flex items-center justify-center text-xs shrink-0">
                        {opt.id}
                      </span>
                      <span>{opt.text}</span>
                    </div>
                    {showAnswerResult && isCorrect && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation when verified */}
            {showAnswerResult && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <span>Metodičko objašnjenje i postupak rješavanja:</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {activeQuestion.explanation}
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                onClick={() => setActiveQuestion(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Zatvori
              </button>

              {!showAnswerResult ? (
                <button
                  onClick={() => setShowAnswerResult(true)}
                  disabled={!selectedOption}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Provjeri odgovor
                </button>
              ) : (
                <button
                  onClick={() => {
                    setActiveQuestion(null);
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Nastavi učenje
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
