import React, { useState, useEffect } from 'react';
import { Subject, Question, StudentAttempt, StudentBadge } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { Clock, CheckCircle2, XCircle, AlertCircle, ArrowLeft, ArrowRight, Flag, RotateCcw, Award, Trophy, Sparkles } from 'lucide-react';
import { BadgeCelebrationModal } from './BadgeCelebrationModal.tsx';

interface ExamSimulatorProps {
  initialSubjectId?: string;
  onExit: () => void;
  onOpenBadges?: () => void;
}

export const ExamSimulator: React.FC<ExamSimulatorProps> = ({ initialSubjectId, onExit, onOpenBadges }) => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId || 'sub-mat');
  const [testState, setTestState] = useState<'setup' | 'active' | 'review'>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [secondsRemaining, setSecondsRemaining] = useState<number>(5400); // 90 min default
  const [attemptResult, setAttemptResult] = useState<StudentAttempt | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [newlyUnlockedBadges, setNewlyUnlockedBadges] = useState<StudentBadge[]>([]);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  useEffect(() => {
    async function loadSubjects() {
      const data = await api.getSubjects();
      setSubjects(data);
      if (!initialSubjectId && data.length > 0) {
        setSelectedSubjectId(data[0].id);
      }
    }
    loadSubjects();
  }, [initialSubjectId]);

  // Timer effect during active test
  useEffect(() => {
    if (testState !== 'active') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [testState]);

  const handleStartSimulation = async (subId: string) => {
    try {
      setLoading(true);
      const data = await api.generateSimulation(subId);
      setQuestions(data.questions);
      setSelectedSubjectId(subId);
      setSecondsRemaining(data.durationMinutes * 60);
      setAnswers({});
      setFlagged({});
      setCurrentQuestionIndex(0);
      setTestState('active');
    } catch (err: any) {
      alert(err.message || 'Greška pri generisanju testa.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const handleToggleFlag = (questionId: string) => {
    setFlagged((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const handleAutoSubmit = async () => {
    await submitTest();
  };

  const submitTest = async () => {
    try {
      setLoading(true);
      setShowSubmitConfirm(false);
      const currentSubject = subjects.find((s) => s.id === selectedSubjectId);
      const totalSeconds = (currentSubject?.durationMinutes || 90) * 60;
      const elapsedSeconds = totalSeconds - secondsRemaining;

      const result: any = await api.submitAttempt(selectedSubjectId, answers, elapsedSeconds);
      setAttemptResult(result);
      if (result.newlyUnlockedBadges && result.newlyUnlockedBadges.length > 0) {
        setNewlyUnlockedBadges(result.newlyUnlockedBadges);
        setShowBadgeModal(true);
      }
      setTestState('review');
    } catch (err) {
      console.error('Greška pri slanju ispita:', err);
      alert('Greška pri predaji ispita.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // 1. SETUP SCREEN: Choose subject to simulate
  if (testState === 'setup') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Simulator eksterne mature
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Probno polaganje ispita u realnim ispitnim uvjetima sa zvaničnim vremenskim ograničenjem
            </p>
          </div>
          <button
            onClick={onExit}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer"
          >
            ← Nazad na ploču
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjects.map((sub) => (
            <div
              key={sub.id}
              className={`p-6 rounded-xl border transition-all cursor-pointer ${
                selectedSubjectId === sub.id
                  ? 'border-indigo-600 ring-2 ring-indigo-100 bg-white'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
              onClick={() => setSelectedSubjectId(sub.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-mono font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-sm">
                    {sub.code}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base mt-2">{sub.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{sub.description}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span>Trajanje: {sub.durationMinutes} min</span>
                <span>Prag prolaznosti: {sub.passingThresholdPercent}%</span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleStartSimulation(sub.id);
                }}
                disabled={loading}
                className="mt-4 w-full py-2 px-3 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
              >
                {loading && selectedSubjectId === sub.id ? 'Priprema testa...' : 'Započni simulaciju ispita'}
              </button>
            </div>
          ))}
        </div>

        {/* Instructions block */}
        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs text-slate-600 leading-relaxed">
          <div className="font-bold text-slate-900 text-sm">Pravila simulacije ispita:</div>
          <p>• Pitanja se nasumično biraju iz službenog ispitnog kataloga za odabrani predmet.</p>
          <p>• Svako pitanje nosi definisan broj bodova (1 do 3 boda ovisno o složenosti).</p>
          <p>• Tokom ispita možete slobodno navigirati između pitanja i označavati pitanja za ponovni pregled (zastavica).</p>
          <p>• Nakon isteka vremena ili ručne predaje, dobićete trenutni izvještaj sa osvojenim bodovima i objašnjenjima za svaki zadatak.</p>
        </div>
      </div>
    );
  }

  // 2. ACTIVE SIMULATION SCREEN
  if (testState === 'active') {
    const currentQ = questions[currentQuestionIndex];
    const answeredCount = Object.keys(answers).length;
    const isLast = currentQuestionIndex === questions.length - 1;
    const isTimeUrgent = secondsRemaining < 300; // < 5 min

    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Sticky Exam Top Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-sm">
              Ispit u toku
            </span>
            <span className="text-sm font-bold text-slate-900">
              {subjects.find((s) => s.id === selectedSubjectId)?.name}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Countdown Timer */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono text-sm font-bold tabular-nums ${
                isTimeUrgent
                  ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              Završi i predaj test
            </button>
          </div>
        </div>

        {/* Question Navigation Matrix */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500 font-medium mr-2">Pitanja:</span>
          {questions.map((q, idx) => {
            const isAnswered = !!answers[q.id];
            const isFlagged = !!flagged[q.id];
            const isCurrent = idx === currentQuestionIndex;

            return (
              <button
                key={q.id}
                onClick={() => setCurrentQuestionIndex(idx)}
                className={`relative w-8 h-8 rounded-md text-xs font-bold font-mono transition-all cursor-pointer ${
                  isCurrent
                    ? 'ring-2 ring-indigo-600 bg-indigo-600 text-white'
                    : isAnswered
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {idx + 1}
                {isFlagged && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full" />
                )}
              </button>
            );
          })}
          <div className="ml-auto text-xs text-slate-500">
            Odgovoreno: <span className="font-semibold text-slate-800 font-mono">{answeredCount}</span> / {questions.length}
          </div>
        </div>

        {/* Current Question Card */}
        {currentQ && (
          <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-800">Zadatak #{currentQuestionIndex + 1}</span>
                <span>·</span>
                <span>Oblast: {currentQ.topic}</span>
                <span>·</span>
                <span>Bodovi: {currentQ.points}</span>
              </div>
              <button
                onClick={() => handleToggleFlag(currentQ.id)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                  flagged[currentQ.id]
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                <span>{flagged[currentQ.id] ? 'Označeno za pregled' : 'Označi za pregled'}</span>
              </button>
            </div>

            {/* Question Text */}
            <div className="text-base sm:text-lg font-medium text-slate-900 leading-relaxed">
              {currentQ.questionText}
            </div>

            {/* Options List */}
            <div className="space-y-3 pt-2">
              {currentQ.options.map((option) => {
                const isSelected = answers[currentQ.id] === option.id;
                return (
                  <label
                    key={option.id}
                    onClick={() => handleSelectOption(currentQ.id, option.id)}
                    className={`flex items-center gap-3.5 p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold border transition-colors ${
                        isSelected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'border-slate-300 text-slate-600 bg-white'
                      }`}
                    >
                      {option.id}
                    </div>
                    <span className="text-sm text-slate-800 leading-normal">{option.text}</span>
                  </label>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                onClick={() => setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentQuestionIndex === 0}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Prethodno pitanje
              </button>

              {isLast ? (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Predaj završeni test →
                </button>
              ) : (
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                >
                  Sljedeće pitanje
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
              <h3 className="font-bold text-slate-900 text-base">Potvrda predaje ispita</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Odgovorili ste na <span className="font-bold text-slate-800">{answeredCount}</span> od ukupno{' '}
                <span className="font-bold text-slate-800">{questions.length}</span> pitanja.
                {answeredCount < questions.length && (
                  <span className="block mt-1 text-amber-700 font-medium">
                    Pažnja: Imate {questions.length - answeredCount} neodgovorenih pitanja!
                  </span>
                )}
                Nakon predaje dobićete trenutni zvanični izvještaj i detaljna metodička objašnjenja.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Nastavi rad
                </button>
                <button
                  onClick={submitTest}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer"
                >
                  {loading ? 'Obrađujem rezultate...' : 'Da, predaj test'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. POST-EXAM REVIEW SCREEN: Detailed score & explanations
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Celebration Modal for newly unlocked badges */}
      {showBadgeModal && newlyUnlockedBadges.length > 0 && (
        <BadgeCelebrationModal
          badges={newlyUnlockedBadges}
          onClose={() => setShowBadgeModal(false)}
          onViewAllBadges={() => {
            setShowBadgeModal(false);
            if (onOpenBadges) onOpenBadges();
          }}
        />
      )}

      {/* Newly Unlocked Badges Notification Card */}
      {newlyUnlockedBadges.length > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-indigo-500/10 border-2 border-amber-300 text-slate-900 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 border border-amber-300 flex items-center justify-center shrink-0 shadow-xs">
              <Trophy className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-amber-800 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Osvojeno novo priznanje!</span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                Otključali ste {newlyUnlockedBadges.length} novih znački: {newlyUnlockedBadges.map((b) => b.title).join(', ')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowBadgeModal(true)}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Prikaži priznanje
            </button>
            {onOpenBadges && (
              <button
                onClick={onOpenBadges}
                className="px-3.5 py-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Sve značke →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Score Header Card */}
      {attemptResult && (
        <div
          className={`p-6 sm:p-8 rounded-2xl border ${
            attemptResult.isPassed
              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              : 'bg-rose-50/70 border-rose-200 text-rose-950'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {attemptResult.isPassed ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-emerald-700 bg-white px-2.5 py-0.5 rounded-sm border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ispit uspješno položen
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-rose-700 bg-white px-2.5 py-0.5 rounded-sm border border-rose-300">
                    <XCircle className="w-3.5 h-3.5" /> Prag prolaznosti nije dostignut
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                Rezultat simulacije: {attemptResult.subjectName}
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Učenik: <span className="font-semibold text-slate-800">{attemptResult.studentName}</span> · Datum predaje: {new Date(attemptResult.completedAt).toLocaleString('bs')}
              </p>
            </div>

            <div className="flex items-center gap-6 self-start sm:self-auto bg-white p-4 rounded-xl border border-slate-200">
              <div>
                <div className="text-[11px] text-slate-500 uppercase font-medium">Postotak</div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900">
                  {attemptResult.percentage}%
                </div>
              </div>
              <div className="border-l border-slate-200 pl-4">
                <div className="text-[11px] text-slate-500 uppercase font-medium">Osvojeni bodovi</div>
                <div className="text-3xl font-extrabold font-mono tabular-nums text-slate-900">
                  {attemptResult.scoreAchieved}/{attemptResult.maxScore}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200/60 text-xs text-slate-700 leading-relaxed">
            <span className="font-semibold">Pedagoški osvrt:</span> {attemptResult.reviewNotes}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleStartSimulation(selectedSubjectId)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Pokušaj ponovo
            </button>
            <button
              onClick={onExit}
              className="px-4 py-2 rounded-lg bg-white text-slate-700 border border-slate-200 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Povratak na matičnu ploču
            </button>
          </div>
        </div>
      )}

      {/* Question by question analysis */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 text-lg">Detaljan pregled odgovora i rješenja</h3>
        {questions.map((q, idx) => {
          const userAns = answers[q.id];
          const isCorrect = userAns === q.correctOptionId;

          return (
            <div
              key={q.id}
              className={`p-6 rounded-xl border bg-white space-y-4 ${
                isCorrect ? 'border-emerald-200' : 'border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">Pitanje #{idx + 1}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{q.topic}</span>
                </div>
                {isCorrect ? (
                  <span className="font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-sm">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Tačno (+{q.points} boda)
                  </span>
                ) : (
                  <span className="font-semibold text-rose-700 flex items-center gap-1 bg-rose-50 px-2 py-0.5 rounded-sm">
                    <XCircle className="w-3.5 h-3.5" /> Netačno (0/{q.points} boda)
                  </span>
                )}
              </div>

              <div className="font-medium text-slate-900 text-sm leading-relaxed">
                {q.questionText}
              </div>

              {/* Options Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {q.options.map((opt) => {
                  const isUserSelection = userAns === opt.id;
                  const isTheCorrectOption = q.correctOptionId === opt.id;

                  let borderClass = 'border-slate-200 bg-slate-50/50';
                  if (isTheCorrectOption) {
                    borderClass = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                  } else if (isUserSelection && !isTheCorrectOption) {
                    borderClass = 'border-rose-500 bg-rose-50 text-rose-900';
                  }

                  return (
                    <div
                      key={opt.id}
                      className={`p-2.5 rounded-lg border flex items-center justify-between ${borderClass}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">{opt.id})</span>
                        <span>{opt.text}</span>
                      </div>
                      {isTheCorrectOption && (
                        <span className="text-[10px] text-emerald-700 uppercase font-bold">Tačan odgovor</span>
                      )}
                      {isUserSelection && !isTheCorrectOption && (
                        <span className="text-[10px] text-rose-700 uppercase font-bold">Vaš izbor</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Explanation & Rationale */}
              {q.explanation && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-700 leading-relaxed">
                  <span className="font-bold text-slate-900">Metodičko objašnjenje:</span> {q.explanation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
