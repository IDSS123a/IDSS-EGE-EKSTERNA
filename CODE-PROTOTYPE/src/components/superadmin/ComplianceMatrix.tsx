import React, { useState, useEffect } from 'react';
import { ComplianceRegulation, ComplianceStatus } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, Edit3, Shield } from 'lucide-react';

export const ComplianceMatrix: React.FC = () => {
  const { t } = useTranslation();
  const [regulations, setRegulations] = useState<ComplianceRegulation[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplianceRegulation | null>(null);
  const [formStatus, setFormStatus] = useState<ComplianceStatus>('compliant');
  const [formNotes, setFormNotes] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await api.getCompliance();
      setRegulations(data);
    } catch (err) {
      console.error('Greška pri učitavanju propisa:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenEdit = (item: ComplianceRegulation) => {
    setEditingItem(item);
    setFormStatus(item.status);
    setFormNotes(item.notes || '');
  };

  const handleSaveCompliance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await api.updateCompliance(editingItem.id, {
        status: formStatus,
        notes: formNotes,
      });
      setEditingItem(null);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Greška pri ažuriranju usklađenosti.');
    }
  };

  const compliantCount = regulations.filter((r) => r.status === 'compliant').length;
  const inProgressCount = regulations.filter((r) => r.status === 'in_progress').length;
  const actionRequiredCount = regulations.filter((r) => r.status === 'action_required').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('superadmin.compliance')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Dosljedna primjena svih propisanih uredbi, pravilnika i zakonskih normi za provođenje eksterne mature
        </p>
      </div>

      {/* Summary status tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-emerald-200 bg-emerald-50/30">
          <div className="text-xs text-emerald-800 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Usklađeno (Compliant)
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-950 mt-1">
            {compliantCount} <span className="text-xs font-normal text-emerald-700">propisa</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Pravno verifikovani uslovi</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/30">
          <div className="text-xs text-amber-800 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" /> U toku realizacije
          </div>
          <div className="text-2xl font-bold font-mono text-amber-950 mt-1">
            {inProgressCount} <span className="text-xs font-normal text-amber-700">propisa</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">U proceduri pripreme</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-rose-200 bg-rose-50/30">
          <div className="text-xs text-rose-800 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600" /> Zahtijeva radnju
          </div>
          <div className="text-2xl font-bold font-mono text-rose-950 mt-1">
            {actionRequiredCount} <span className="text-xs font-normal text-rose-700">propisa</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Hitno usklađivanje</div>
        </div>
      </div>

      {/* Regulations Compliance Checklist */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Regulatorni registar i verifikacija</h2>
          <span className="text-xs text-slate-500 font-mono">Ukupno: {regulations.length}</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {regulations.map((reg) => {
            let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            let label = 'Usklađeno';
            if (reg.status === 'in_progress') {
              badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
              label = 'U toku';
            } else if (reg.status === 'action_required') {
              badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
              label = 'Zahtijeva radnju';
            }

            return (
              <div key={reg.id} className="p-5 hover:bg-slate-50/60 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 text-sm">{reg.actTitle}</div>
                    <div className="font-mono text-indigo-700 font-medium">{reg.articleReference}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-sm border font-semibold ${badgeClass}`}>
                      {label}
                    </span>
                    <button
                      onClick={() => handleOpenEdit(reg)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                      title="Ažuriraj verifikaciju"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-slate-700 leading-relaxed max-w-4xl">
                  {reg.requirementSummary}
                </p>

                {reg.notes && (
                  <div className="p-2.5 bg-slate-50 rounded-lg text-slate-600 border border-slate-100">
                    <span className="font-semibold text-slate-700">Službena zabilješka:</span> {reg.notes}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
                  <div>Odgovorno lice: <span className="text-slate-600 font-medium">{reg.responsiblePerson}</span></div>
                  <div>Zadnja verifikacija: {new Date(reg.lastVerifiedAt).toLocaleString('bs')}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Verifikacija propisa</h2>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {editingItem.articleReference}
                </div>
              </div>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCompliance} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status usklađenosti *</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as ComplianceStatus)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                >
                  <option value="compliant">Usklađeno (U potpunosti primijenjeno)</option>
                  <option value="in_progress">U toku (Radnje se provode)</option>
                  <option value="action_required">Zahtijeva radnju (Nije usklađeno)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Službena zabilješka i dokaz usklađenosti</label>
                <textarea
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Navedite broj akta, datum sjednice ili protokolarni dokaz..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  Verifikuj propis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
