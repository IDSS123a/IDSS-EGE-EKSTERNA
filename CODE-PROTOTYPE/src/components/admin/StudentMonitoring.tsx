import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import { Users, AlertTriangle, TrendingUp, CheckCircle, BarChart3, ArrowRight } from 'lucide-react';

export const StudentMonitoring: React.FC = () => {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await api.getAdminOverview();
        setOverview(data);
      } catch (err) {
        console.error('Greška pri učitavanju pregleda učenika:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !overview) {
    return <div className="p-12 text-center text-slate-400 text-xs">Učitavanje podataka o učenicima...</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('monitoring.title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Uporedni pokazatelji postignuća po odjeljenjima i rana identifikacija učenika kojima je potrebna dopunska podrška
        </p>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Ukupno maturanata</div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1 tabular-nums">
            {overview.totalStudents}
          </div>
          <div className="text-xs text-slate-500 mt-1">U evidenciji škole</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Ispitnih sesija</div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1 tabular-nums">
            {overview.totalExamSessions}
          </div>
          <div className="text-xs text-slate-500 mt-1">Zvanično raspoređeno</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Zadataka u ispitnoj bazi</div>
          <div className="text-2xl font-bold text-indigo-700 font-mono mt-1 tabular-nums">
            {overview.totalQuestions}
          </div>
          <div className="text-xs text-slate-500 mt-1">Klasifikovano po domenima</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Učenici sa prilagodbama</div>
          <div className="text-2xl font-bold text-emerald-700 font-mono mt-1 tabular-nums">
            {overview.totalAccommodations}
          </div>
          <div className="text-xs text-slate-500 mt-1">Inkluzivni programi</div>
        </div>
      </div>

      {/* Class Comparison Grid */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">Usporedba po odjeljenjima IV razreda</h2>
          <p className="text-xs text-slate-500 mt-0.5">Prosječan uspjeh na dosadašnjim probnim simulacijama eksterne mature</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {overview.classBreakdown?.map((cls: any) => (
            <div key={cls.className} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">{cls.className}</span>
                <span className="font-mono text-lg font-bold text-indigo-700 tabular-nums">
                  {cls.averagePercentage}%
                </span>
              </div>

              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    cls.averagePercentage >= 75
                      ? 'bg-emerald-500'
                      : cls.averagePercentage >= 50
                      ? 'bg-indigo-500'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${Math.max(cls.averagePercentage, 5)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
                <div>Učenika: <strong className="font-mono text-slate-800">{cls.studentCount}</strong></div>
                <div>Riješeno testova: <strong className="font-mono text-slate-800">{cls.attemptsCount}</strong></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* At-Risk Students Warning Section */}
      <div className="bg-white rounded-xl border border-amber-200 overflow-hidden shadow-2xs">
        <div className="p-5 bg-amber-50/60 border-b border-amber-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-bold text-amber-950">
              Učenici kojima je potrebna dodatna pedagoška podrška (Ispod 50% praga)
            </h2>
          </div>
          <span className="text-xs font-mono text-amber-800">
            Identifikovano: {overview.atRiskStudents?.length || 0}
          </span>
        </div>

        <div className="p-5 text-xs">
          {overview.atRiskStudents?.length === 0 ? (
            <div className="text-emerald-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Svi učenici koji su polagali simulacije trenutno ostvaruju rezultate iznad praga prolaznosti (50%).
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {overview.atRiskStudents.map((st: any) => (
                <div key={st.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-900">{st.fullName}</span> ({st.className})
                    <span className="text-slate-400 mx-2">·</span>
                    <span className="text-slate-500 font-mono">{st.studentIdNumber}</span>
                  </div>
                  <span className="text-amber-800 font-semibold bg-amber-100 px-2 py-0.5 rounded text-[11px]">
                    Planirati dopunsku nastavu
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
