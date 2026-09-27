import React, { useState, useEffect } from 'react';
import { Subject, Question, StudentBadge, StudentBadgeSummary } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import { Search, Filter, HelpCircle, Check, Eye, EyeOff, Flame, Trophy, Sparkles, CheckCircle2 } from 'lucide-react';
import { BadgeCelebrationModal } from './BadgeCelebrationModal.tsx';

interface QuestionPracticeProps {
  initialSubjectId?: string;
  onOpenBadges?: () => void;
}

export const QuestionPractice: React.FC<QuestionPracticeProps> = ({ initialSubjectId, onOpenBadges }) => {
  const { language } = useTranslation();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubjectId || '');
  const [difficulty, setDifficulty] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [search, setSearch] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});
  const [userSelections, setUserSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [badgeSummary, setBadgeSummary] = useState<StudentBadgeSummary | null>(null);
  const [celebrateBadges, setCelebrateBadges] = useState<StudentBadge[]>([]);
  const [sessionAnswered, setSessionAnswered] = useState(0);

  useEffect(() => {
    async function loadData() {
      const [subs, bSummary] = await Promise.all([
        api.getSubjects(),
        api.getBadges(),
      ]);
      setSubjects(subs);
      setBadgeSummary(bSummary);
      if (!initialSubjectId && subs.length > 0) {
        setSelectedSubject(subs[0].id);
      }
    }
    loadData();
  }, [initialSubjectId]);

  useEffect(() => {
    async function fetchQuestions() {
      try {
        setLoading(true);
        const data = await api.getQuestions({
          subjectId: selectedSubject || undefined,
          difficulty: difficulty || undefined,
          domain: domain || undefined,
          search: search || undefined,
        });
        setQuestions(data);
      } catch (err) {
        console.error('Greška pri dohvatanju pitanja:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, [selectedSubject, difficulty, domain, search]);

  const toggleReveal = async (qId: string) => {
    const isNowRevealed = !revealedSolutions[qId];
    setRevealedSolutions((prev) => ({ ...prev, [qId]: isNowRevealed }));

    if (isNowRevealed) {
      try {
        const q = questions.find((item) => item.id === qId);
        const res = await api.recordPracticeActivity({
          type: 'solution_revealed',
          subjectId: q?.subjectId,
          questionId: qId,
        });
        if (res.summary) setBadgeSummary(res.summary);
        if (res.newlyUnlockedBadges && res.newlyUnlockedBadges.length > 0) {
          setCelebrateBadges(res.newlyUnlockedBadges);
        }
      } catch (e) {
        console.error('Greška pri bilježenju aktivnosti:', e);
      }
    }
  };

  const handleSelectOption = async (qId: string, optId: string) => {
    setUserSelections((prev) => ({ ...prev, [qId]: optId }));
    setSessionAnswered((prev) => prev + 1);

    const question = questions.find((q) => q.id === qId);
    const isCorrect = question ? question.correctOptionId === optId : false;

    try {
      const res = await api.recordPracticeActivity({
        type: 'question_answered',
        subjectId: question?.subjectId,
        questionId: qId,
        isCorrect,
      });

      if (res.summary) {
        setBadgeSummary(res.summary);
      }

      if (res.newlyUnlockedBadges && res.newlyUnlockedBadges.length > 0) {
        setCelebrateBadges(res.newlyUnlockedBadges);
      }
    } catch (err) {
      console.error('Greška pri spremanju aktivnosti vježbanja:', err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Badge Celebration Popup if new badge unlocked during practice */}
      {celebrateBadges.length > 0 && (
        <BadgeCelebrationModal
          badges={celebrateBadges}
          onClose={() => setCelebrateBadges([])}
          onViewAllBadges={() => {
            setCelebrateBadges([]);
            if (onOpenBadges) onOpenBadges();
          }}
        />
      )}

      {/* Header with live Practice Badge Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Vježbaonica ispitnih pitanja
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Pretražujte standardizirana ispitna pitanja iz kataloga, testirajte znanje i provjerite objašnjenja
          </p>
        </div>

        {/* Live Practice Streak & Session Stats Card */}
        {badgeSummary && (
          <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs self-start sm:self-auto">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-300 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-left text-xs">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>{badgeSummary.currentStreakDays}-dnevni niz</span>
                <span className="text-slate-400">·</span>
                <span className="text-indigo-600 font-mono">Riješeno danas: {sessionAnswered}</span>
              </div>
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span>Značke: {badgeSummary.unlockedCount}/{badgeSummary.totalBadges}</span>
                {onOpenBadges && (
                  <button
                    onClick={onOpenBadges}
                    className="text-indigo-600 font-semibold hover:underline cursor-pointer ml-1"
                  >
                    Pregled →
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Predmet</label>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Svi predmeti</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nivo težine</label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Svi nivoi</option>
            <option value="basic">Osnovni nivo</option>
            <option value="intermediate">Srednji nivo</option>
            <option value="advanced">Napredni nivo</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Kognitivni domen</label>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full text-xs rounded-lg border border-slate-200 p-2 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Sve domene</option>
            <option value="knowledge">Poznavanje činjenica</option>
            <option value="comprehension">Razumijevanje</option>
            <option value="application">Primjena znanja</option>
            <option value="analysis">Analiza i sinteza</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Pretraga pojmova</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Pretraži tekst ili temu..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs rounded-lg border border-slate-200 p-2 pl-8 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>
      </div>

      {/* Questions list */}
      <div className="space-y-4">
        <div className="text-xs text-slate-500 flex items-center justify-between">
          <span>Pronađeno pitanja: <strong className="text-slate-800 font-mono">{questions.length}</strong></span>
          <span>Kliknite na odgovor za provjeru ili otkrijte tačno rješenje.</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Učitavanje zadataka...</div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-500 text-sm">
            Nema pronađenih pitanja za odabrane kriterije.
          </div>
        ) : (
          questions.map((q, idx) => {
            const isRevealed = revealedSolutions[q.id];
            const userChoice = userSelections[q.id];

            return (
              <div key={q.id} className="bg-white p-6 rounded-xl border border-slate-200 space-y-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono">#{idx + 1}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-medium text-slate-700">{q.topic}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">
                      {q.difficulty === 'basic' ? 'Osnovni' : q.difficulty === 'intermediate' ? 'Srednji' : 'Napredni'} nivo
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 font-mono text-[11px]">Bodovi: {q.points}</span>
                    <button
                      onClick={() => toggleReveal(q.id)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{isRevealed ? 'Sakrij rješenje' : 'Prikaži rješenje'}</span>
                    </button>
                  </div>
                </div>

                <div className="text-sm font-medium text-slate-900 leading-relaxed">
                  {q.questionText}
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                  {q.options.map((opt) => {
                    const isSelected = userChoice === opt.id;
                    const isCorrect = q.correctOptionId === opt.id;

                    let style = 'border-slate-200 hover:bg-slate-50 text-slate-700';
                    if (isRevealed) {
                      if (isCorrect) style = 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold';
                      else if (isSelected) style = 'border-rose-300 bg-rose-50 text-rose-800';
                    } else if (isSelected) {
                      style = 'border-indigo-600 bg-indigo-50/70 text-indigo-900 font-semibold';
                    }

                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSelectOption(q.id, opt.id)}
                        className={`text-left p-3 rounded-lg border transition-colors flex items-center justify-between cursor-pointer ${style}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-mono font-bold">{opt.id})</span>
                          <span>{opt.text}</span>
                        </span>
                        {isRevealed && isCorrect && (
                          <span className="text-[10px] text-emerald-700 uppercase font-bold">Tačno</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Solution Reveal Accordion */}
                {isRevealed && (
                  <div className="p-3.5 bg-emerald-50/60 rounded-lg border border-emerald-200 text-xs text-emerald-950 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <Check className="w-4 h-4 text-emerald-700" />
                      Tačan odgovor je {q.correctOptionId}
                    </div>
                    <p className="text-slate-700">{q.explanation}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
