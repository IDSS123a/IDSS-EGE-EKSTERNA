import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import { SchoolSettings, ComplianceRegulation } from '../../types/index.ts';
import {
  TrendingUp,
  ShieldCheck,
  Award,
  Users,
  Building,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  FileCheck,
} from 'lucide-react';

interface ExecutiveDashboardProps {
  onNavigateTab: (tab: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ onNavigateTab }) => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [regulations, setRegulations] = useState<ComplianceRegulation[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [sett, regs, ov] = await Promise.all([
          api.getSchoolSettings(),
          api.getCompliance(),
          api.getAdminOverview(),
        ]);
        setSettings(sett);
        setRegulations(regs);
        setOverview(ov);
      } catch (err) {
        console.error('Greška pri učitavanju direktorskog dashboarda:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading || !settings) {
    return <div className="p-12 text-center text-slate-400 text-xs">Učitavanje direktorskog pregleda...</div>;
  }

  const compliantCount = regulations.filter((r) => r.status === 'compliant').length;
  const complianceRate = Math.round((compliantCount / regulations.length) * 100);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Executive Welcome & School Details */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-indigo-400 uppercase tracking-widest font-semibold">
              Kancelarija direktora škole · Upravni nadzor
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {settings.schoolName}
            </h1>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Šifra ustanove: <span className="font-mono text-white">{settings.schoolCode}</span> · {settings.cantonMinistry} · Nadležni rukovodilac: <span className="text-white font-medium">{settings.schoolDirector}</span>.
            </p>
          </div>

          <div className="bg-white/10 p-4 rounded-xl border border-white/10 backdrop-blur-xs text-right self-start sm:self-auto">
            <div className="text-[11px] text-slate-300 uppercase">Indeks zakonske usklađenosti</div>
            <div className="text-3xl font-extrabold font-mono text-emerald-400 tabular-nums">
              {complianceRate}%
            </div>
            <div className="text-[11px] text-slate-300">
              {compliantCount} od {regulations.length} propisa verificirano
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Broj prijavljenih maturanata</div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1 tabular-nums">
            {overview?.totalStudents ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Generacija IV razreda</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Prag prolaznosti mature</div>
          <div className="text-2xl font-bold text-indigo-700 font-mono mt-1 tabular-nums">
            {settings.passingThresholdPercent}%
          </div>
          <div className="text-xs text-slate-500 mt-1">Usvojeno na Školskom odboru</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Planirane ispitne sale</div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1 tabular-nums">
            {overview?.totalExamSessions ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Imenovane ispitne komisije</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Baza zadataka eksterne mature</div>
          <div className="text-2xl font-bold text-slate-900 font-mono mt-1 tabular-nums">
            {overview?.totalQuestions ?? 0}
          </div>
          <div className="text-xs text-emerald-600 font-medium mt-1">Verifikovana tajnost testova</div>
        </div>
      </div>

      {/* Main Director Modules Quick Access */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Compliance Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Zakonska usklađenost</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Pregled primjene zakonskih propisa, pravilnika o tajnosti ispitnog materijala, žalbenim rokovima i radu komisija.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('superadmin-compliance')}
            className="w-full py-2 px-3 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            Pregledaj matricu propisa →
          </button>
        </div>

        {/* Audit Log Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <FileCheck className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Revizijski trag (Audit Trail)</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Elektronska evidencija svih akcija, izmjena pitanja, zakazanih ispita i unosa bodova sa IP adresama i žigovima.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('superadmin-audit')}
            className="w-full py-2 px-3 text-xs font-semibold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            Otvori revizijski dnevnik →
          </button>
        </div>

        {/* School Settings & Users Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4 shadow-2xs flex flex-col justify-between">
          <div className="space-y-2">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Building className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Matične postavke & Uloge</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upravljanje ovlaštenjima osoblja, dodjeljivanje uloga (Admin/Nastavnik/Učenik) i konfiguracija parametara mature.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('superadmin-users')}
            className="w-full py-2 px-3 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            Postavke i korisnici →
          </button>
        </div>
      </div>
    </div>
  );
};
