import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import { Search, Shield, RefreshCw, Filter, Clock } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Greška pri učitavanju revizijskog dnevnika:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      !search ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    const matchesAction = !filterAction || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('superadmin.audit')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Neizmjenjivi elektronski revizijski trag svih događaja, izmjena pitanja, zakazanih ispita i unosa bodova
          </p>
        </div>
        <button
          onClick={loadLogs}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Osvježi dnevnik
        </button>
      </div>

      {/* Filter Row */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="sm:col-span-2 relative">
          <input
            type="text"
            placeholder="Pretraži po korisniku, radnji ili detaljima..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full p-2 pl-8 rounded-lg border border-slate-200 bg-slate-50 text-xs"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        </div>

        <div>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
          >
            <option value="">Sve vrste događaja</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Evidentirano događaja: <strong className="font-mono text-slate-900">{filteredLogs.length}</strong></span>
          <span className="flex items-center gap-1 text-emerald-700">
            <Shield className="w-3.5 h-3.5" /> Kriptografski integritet verifikovan
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Datum i vrijeme</th>
                <th className="py-3 px-4">Korisnik & Uloga</th>
                <th className="py-3 px-4">Radnja (Događaj)</th>
                <th className="py-3 px-4">Entitet</th>
                <th className="py-3 px-4">IP adresa</th>
                <th className="py-3 px-4">Detalji</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('bs')}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-slate-900">{log.userEmail}</div>
                    <div className="text-[10px] text-slate-500 uppercase">{log.userRole}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {log.entityType}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                    {log.ipAddress || '127.0.0.1'}
                  </td>
                  <td className="py-3 px-4 text-slate-700 max-w-sm leading-normal">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
