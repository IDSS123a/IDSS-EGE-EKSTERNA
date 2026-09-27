import React, { useEffect, useState } from 'react';
import { User, ExamSession, Subject, StudentBadgeSummary } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import { Calendar, Clock, MapPin, Award, CheckCircle, AlertTriangle, ArrowRight, Play, BookOpen, Trophy, Flame, Sparkles, Brain } from 'lucide-react';

interface StudentDashboardProps {
  currentUser: User;
  onStartSimulation: (subjectId: string) => void;
  onOpenPractice: (subjectId?: string) => void;
  onOpenRules: () => void;
  onOpenAnalytics: () => void;
  onOpenBadges?: () => void;
  onOpenAITutor?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  onStartSimulation,
  onOpenPractice,
  onOpenRules,
  onOpenAnalytics,
  onOpenBadges,
  onOpenAITutor,
}) => {
  const { t, language } = useTranslation();
  const [exams, setExams] = useState<ExamSession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [badgeSummary, setBadgeSummary] = useState<StudentBadgeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [exData, subData, anData, badgeData] = await Promise.all([
          api.getExams(),
          api.getSubjects(),
          api.getStudentAnalytics(currentUser.id),
          api.getBadges(currentUser.id),
        ]);
        setExams(exData);
        setSubjects(subData);
        setAnalytics(anData);
        setBadgeSummary(badgeData);
      } catch (err) {
        console.error('Greška pri učitavanju podataka učenika:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentUser.id]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center items-center text-slate-500 text-sm">
        Učitavanje podataka učenika...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner with institutional campus imagery */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 text-white shadow-xs">
        <img
          src="/src/assets/images/idss_matura_hero_1790457700291.jpg"
          alt="IDSS Matura Portal"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="relative z-10 p-6 sm:p-8 max-w-3xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-slate-950/90 border border-slate-700/80 p-1.5 flex items-center justify-center shrink-0 shadow-sm">
              <img
                src="https://idss.edu.ba/wp-content/uploads/2024/03/logo_white.png"
                alt="IDSS Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-amber-300 font-semibold tracking-wide uppercase">
                  Internationale Deutsche Schule Sarajevo · IDSS
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/30">
                  Deveti razred · 9. Klasse
                </span>
                <span className="text-slate-400 text-xs">·</span>
                <span className="text-xs text-slate-300 font-mono">Privatna osnovna škola</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-0.5">
                Dobrodošli, {currentUser.fullName}
              </h1>
            </div>
          </div>
          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            {t('student.class')}: <span className="text-white font-medium">{currentUser.className || 'IX-1 (9a)'}</span> · {t('student.indexNumber')}: <span className="text-white font-mono">{currentUser.studentIdNumber || 'IDSS-IX-2026-001'}</span>.
            Ovdje možete vježbati ispitne zadatke iz kataloga Ministarstva za odgoj i obrazovanje KS i IDSS kurikuluma (B/H/S jezik, Matematika, Njemački jezik / DSD I i Engleski jezik), polagati simulacije ispita s vremenskim ograničenjem i pratiti vlastitu spremnost.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onStartSimulation('sub-mat')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              Pokreni ispit: Matematika (IX razred)
            </button>
            <button
              onClick={() => onStartSimulation('sub-deu')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 fill-white" />
              Pokreni ispit: Deutsch / DSD I
            </button>
            <button
              onClick={() => onOpenPractice()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium backdrop-blur-xs transition-colors cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              Otvori vježbaonicu zadataka
            </button>
            {onOpenAITutor && (
              <button
                onClick={onOpenAITutor}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <Brain className="w-4 h-4" />
                AI Tutor & Plan učenja
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Badges & Consistency Streak Showcase Widget */}
      {badgeSummary && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Left: Streak & Progress Bar */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-300 flex items-center justify-center shrink-0">
                <Flame className="w-8 h-8 text-amber-500" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900">
                    {badgeSummary.currentStreakDays}-dnevni niz učenja
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    🔥 Aktivno
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Otključano <strong className="text-slate-800 font-mono">{badgeSummary.unlockedCount}</strong> od <strong className="text-slate-800 font-mono">{badgeSummary.totalBadges}</strong> postignuća ({badgeSummary.unlockedPercent}%).
                </p>
                <div className="w-48 sm:w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-indigo-600 rounded-full transition-all duration-700"
                    style={{ width: `${badgeSummary.unlockedPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Middle: Recent Unlocked Badges Preview */}
            <div className="flex items-center gap-3 overflow-x-auto py-1">
              {badgeSummary.recentUnlocked.map((b) => (
                <div
                  key={b.badgeId}
                  className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl shrink-0"
                  title={b.description}
                >
                  <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold shrink-0">
                    {b.tier === 'diamond' ? '💎' : b.tier === 'gold' ? '🥇' : b.tier === 'silver' ? '🥈' : '🥉'}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-900 truncate max-w-[130px]">
                      {language === 'de' && b.titleDe ? b.titleDe : language === 'en' && b.titleEn ? b.titleEn : b.title}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-medium">✓ Osvojeno</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right: CTA to full Badges Center */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={onOpenBadges}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all border border-indigo-200 cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-indigo-600" />
                <span>Sve značke i izazovi ({badgeSummary.totalBadges})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Tutor Diagnostics & Study Plan Card */}
      {onOpenAITutor && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-2xs hover:border-indigo-300 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Brain className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    AI Tutor: Personalizovani plan učenja i analiza slabosti
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    Aktivno
                  </span>
                </div>
                <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
                  Na osnovu tvojih simuliranih ispita, AI Tutor je prepoznao ključne izazove (linearne jednačine sa razlomcima, obla tijela, mehanički rad) i kreirao 5-dnevni plan pripreme sa ciljanim zadacima.
                </p>
              </div>
            </div>

            <button
              onClick={onOpenAITutor}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0 self-start sm:self-auto"
            >
              <span>Pregledaj plan učenja</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Metrics Row (Anti-slop clean typography, tabular numbers, no floating random scorecards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium mb-1">Ukupno simulacija</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {analytics?.totalSimulations ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Riješenih probnih testova</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium mb-1">Prosječan rezultat</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {analytics?.overallAverage ?? 0}%
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">Prag prolaznosti: 50%</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium mb-1">Prolaznost na simulacijama</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {analytics?.passRatePercent ?? 0}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {analytics?.passedSimulations ?? 0} od {analytics?.totalSimulations ?? 0} uspješnih
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium mb-1">Status usklađenosti prijave</div>
          <div className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5 mt-1">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            Prijava verificirana
          </div>
          <div className="text-xs text-slate-500 mt-1">Pravo izlaska na rok potvrđeno</div>
        </div>
      </div>

      {/* Main Content Grid: Upcoming Exams & Subject Readiness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Official Exam Schedule (2 cols wide) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Zvanični raspored eksterne mature</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Termini, ispitne sale i dodijeljene ispitne komisije za redovni rok
                </p>
              </div>
              <button
                onClick={onOpenRules}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
              >
                Pravila ponašanja →
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {exams.map((exam) => (
                <div key={exam.id} className="p-5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    <h3 className="font-semibold text-slate-900 text-sm">
                      {exam.title}
                    </h3>
                    <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-sm self-start sm:self-auto">
                      Trajanje: {exam.durationMinutes} min
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600 mt-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{exam.examDate} u {exam.startTime}h</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{exam.roomNumber}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate" title={exam.commission.president}>
                        Predsjednik: {exam.commission.president}
                      </span>
                    </div>
                  </div>

                  {exam.notes && (
                    <div className="mt-3 p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-100">
                      <span className="font-semibold text-slate-700">Napomena za kandidate:</span> {exam.notes}
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                      onClick={() => onStartSimulation(exam.subjectId)}
                      className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors cursor-pointer"
                    >
                      Simuliraj ovaj ispit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Candidate Code of Conduct & Legal Advice Banner */}
          <div className="p-5 rounded-xl border border-amber-200 bg-amber-50/70 text-amber-900 flex items-start gap-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs leading-relaxed">
              <div className="font-bold text-amber-900 text-sm">
                Važna zakonska uputstva za kandidate (Član 21. Pravilnika)
              </div>
              <p>
                Kandidati su dužni pristupiti ispitnom mjestu najkasnije 30 minuta prije zakazanog termina,
                uz predočenje važećeg identifikacionog dokumenta (lična karta ili đačka knjižica sa fotografijom).
                Unošenje elektronskih uređaja (mobiteli, pametni satovi) u ispitnu salu povlači trenutnu diskvalifikaciju.
              </p>
              <button
                onClick={onOpenRules}
                className="font-semibold underline hover:text-amber-950 mt-1 inline-block cursor-pointer"
              >
                Pročitajte kompletan Pravilnik o polaganju eksterne mature →
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Subject Readiness & Quick Launch */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900 text-sm">Spremnost po predmetima</h3>
              <button
                onClick={onOpenAnalytics}
                className="text-xs text-indigo-600 font-medium hover:underline cursor-pointer"
              >
                Detalji
              </button>
            </div>

            <div className="space-y-4">
              {subjects.map((sub) => {
                const subStat = analytics?.subjectStats?.find((s: any) => s.subjectId === sub.id);
                const pct = subStat?.averagePercentage || 0;
                return (
                  <div key={sub.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{sub.name}</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-700">
                        {pct > 0 ? `${pct}%` : 'Nije testirano'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-indigo-500' : pct > 0 ? 'bg-amber-500' : 'bg-slate-200'
                        }`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Pokušaja: {subStat?.attemptsCount || 0}</span>
                      <button
                        onClick={() => onStartSimulation(sub.id)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
                      >
                        Vježbaj test →
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick study tips */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm">Savjeti za polaganje</h3>
            <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
              <li>Rješavajte simulacije u realnom vremenskom okviru (90 do 120 minuta).</li>
              <li>Prvo riješite zadatke osnovnog nivoa koje pouzdano znate.</li>
              <li>Kod pitanja s višestrukim izborom koristite metodu eliminacije.</li>
              <li>Nakon završetka ispita temeljito proučite ponuđena metodička objašnjenja.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
