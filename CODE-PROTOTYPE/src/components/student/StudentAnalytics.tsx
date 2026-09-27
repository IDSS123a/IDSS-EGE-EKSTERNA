import React, { useEffect, useState } from 'react';
import { User, StudentAttempt, StudentBadgeSummary } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { SubjectMasteryD3Chart } from './SubjectMasteryD3Chart.tsx';
import { Award, CheckCircle, XCircle, TrendingUp, Calendar, Clock, BarChart3, Trophy, Flame, Sparkles, ArrowRight, Brain } from 'lucide-react';

interface StudentAnalyticsProps {
  currentUser: User;
  onOpenBadges?: () => void;
  onOpenAITutor?: () => void;
}

export const StudentAnalytics: React.FC<StudentAnalyticsProps> = ({ currentUser, onOpenBadges, onOpenAITutor }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [badgeSummary, setBadgeSummary] = useState<StudentBadgeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [anData, attData, badgeData] = await Promise.all([
          api.getStudentAnalytics(currentUser.id),
          api.getAttempts(currentUser.id),
          api.getBadges(currentUser.id),
        ]);
        setAnalytics(anData);
        setAttempts(attData);
        setBadgeSummary(badgeData);
      } catch (err) {
        console.error('Greška pri učitavanju analitike:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentUser.id]);

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Učitavanje analitike...</div>;
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Analitika uspjeha i praćenje napretka
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Pregled rezultata simulacija, nivoa savladanosti ispitnih oblasti i preporuke za poboljšanje
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Ukupno simulacija</div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1 tabular-nums">
            {analytics?.totalSimulations ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Uspješno položeno: <span className="text-emerald-600 font-semibold">{analytics?.passedSimulations ?? 0}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Prosječan rezultat</div>
          <div className="text-3xl font-extrabold text-slate-900 font-mono mt-1 tabular-nums">
            {analytics?.overallAverage ?? 0}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Zakonski prag prolaznosti: 50%
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Ukupna stopa prolaza</div>
          <div className="text-3xl font-extrabold text-indigo-600 font-mono mt-1 tabular-nums">
            {analytics?.passRatePercent ?? 0}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Na bazi svih simuliranih testova
          </div>
        </div>
      </div>

      {/* AI Tutor Personalized Action Banner */}
      {onOpenAITutor && (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-indigo-800/40">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-300">
              <Brain className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">
                  AI Tutor & Personalizovani plan učenja
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950">
                  ✨ Novo
                </span>
              </div>
              <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
                Automatska dijagnostika analizira tvoje greške u zadacima, detektuje slabe tačke (algebarske jednačine sa razlomcima, obla tijela, formule iz fizike) i generiše ciljani 5-dnevni plan pripreme sa zadacima iz baze.
              </p>
            </div>
          </div>
          <button
            onClick={onOpenAITutor}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <span>Pokreni AI Tutor analizu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* D3 Historical Progression Chart (Last 10 Practice Sessions) */}
      <SubjectMasteryD3Chart attempts={attempts} />

      {/* Badges & Mastery Achievements Card */}
      {badgeSummary && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-300 flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Osvojene značke i nivoi vještina
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    🔥 {badgeSummary.currentStreakDays}-dnevni niz
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Otključano {badgeSummary.unlockedCount} od {badgeSummary.totalBadges} znački ({badgeSummary.unlockedPercent}%)
                </p>
              </div>
            </div>

            {onOpenBadges && (
              <button
                onClick={onOpenBadges}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer self-start sm:self-auto"
              >
                <span>Pregledaj sve značke</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {badgeSummary.recentUnlocked.map((b) => (
              <div
                key={b.badgeId}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center gap-2.5"
              >
                <div className="text-lg">
                  {b.tier === 'diamond' ? '💎' : b.tier === 'gold' ? '🥇' : b.tier === 'silver' ? '🥈' : '🥉'}
                </div>
                <div className="overflow-hidden">
                  <div className="text-xs font-bold text-slate-900 truncate">{b.title}</div>
                  <div className="text-[10px] text-emerald-600 font-medium">Otključano ✓</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subject Mastery Progress Bars */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-6">
        <div>
          <h2 className="text-base font-bold text-slate-900">Uspješnost po ispitnim predmetima</h2>
          <p className="text-xs text-slate-500 mt-0.5">Analiza prosječnih postignuća u odnosu na standarde eksterne mature</p>
        </div>

        <div className="space-y-5">
          {analytics?.subjectStats?.map((sub: any) => {
            const pct = sub.averagePercentage;
            let statusColor = 'text-slate-500';
            let barColor = 'bg-slate-300';

            if (pct >= 75) {
              statusColor = 'text-emerald-600';
              barColor = 'bg-emerald-500';
            } else if (pct >= 50) {
              statusColor = 'text-indigo-600';
              barColor = 'bg-indigo-500';
            } else if (pct > 0) {
              statusColor = 'text-amber-600';
              barColor = 'bg-amber-500';
            }

            return (
              <div key={sub.subjectId} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-900">{sub.subjectName}</span>
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-slate-500">Pokušaja: {sub.attemptsCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${statusColor}`}>
                      {sub.readinessStatus}
                    </span>
                    <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                      {pct}%
                    </span>
                  </div>
                </div>

                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Attempts History Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Historija rješavanja testova</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sve prethodne simulacije sa ocjenama i zabilješkama</p>
          </div>
          <span className="text-xs font-mono text-slate-500">Ukupno zapisa: {attempts.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Predmet</th>
                <th className="py-3 px-4">Datum i vrijeme</th>
                <th className="py-3 px-4">Trajanje</th>
                <th className="py-3 px-4 text-right">Osvojeno</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Pedagoška zabilješka</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attempts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Još niste polagali nijednu simulaciju ispita.
                  </td>
                </tr>
              ) : (
                attempts.map((att) => (
                  <tr key={att.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{att.subjectName}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {new Date(att.completedAt).toLocaleDateString('bs')}{' '}
                      <span className="text-slate-400">{new Date(att.completedAt).toLocaleTimeString('bs', { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {Math.floor(att.durationSeconds / 60)} min
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold tabular-nums">
                      <span className="text-slate-900">{att.percentage}%</span>{' '}
                      <span className="text-slate-400 font-normal">({att.scoreAchieved}/{att.maxScore})</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {att.isPassed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm">
                          <CheckCircle className="w-3 h-3" /> Položio
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-sm">
                          <XCircle className="w-3 h-3" /> Pao
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={att.reviewNotes}>
                      {att.reviewNotes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
