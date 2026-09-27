import React, { useState, useEffect } from 'react';
import { SchoolSettings, User, UserRole } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import { Building, Users, Save, ShieldAlert, CheckCircle } from 'lucide-react';

export const SchoolSettingsManager: React.FC = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sett, userList] = await Promise.all([
        api.getSchoolSettings(),
        api.getUsers(),
      ]);
      setSettings(sett);
      setUsers(userList);
    } catch (err) {
      console.error('Greška pri učitavanju postavki:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      setLoading(true);
      await api.updateSchoolSettings(settings);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Greška pri spremanju postavki.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Greška pri izmjeni uloge.');
    }
  };

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    try {
      const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
      await api.updateUserStatus(userId, nextStatus);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Greška pri promjeni statusa.');
    }
  };

  if (loading && !settings) {
    return <div className="p-12 text-center text-slate-400 text-xs">Učitavanje postavki...</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {t('superadmin.settings')}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upravljanje profilom ustanove, pragovima prolaznosti i korisničkim dozvolama
        </p>
      </div>

      {savedSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Matične postavke škole uspješno ažurirane i zabilježene u revizijski trag.
        </div>
      )}

      {/* School Parameters Form */}
      {settings && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5 shadow-2xs">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building className="w-4 h-4 text-indigo-600" />
              Matični podaci ustanove i parametri mature
            </h2>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Naziv škole / ustanove *</label>
                <input
                  type="text"
                  value={settings.schoolName}
                  onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Službena šifra škole *</label>
                <input
                  type="text"
                  value={settings.schoolCode}
                  onChange={(e) => setSettings({ ...settings, schoolCode: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nadležno ministarstvo</label>
                <input
                  type="text"
                  value={settings.cantonMinistry}
                  onChange={(e) => setSettings({ ...settings, cantonMinistry: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Školska godina</label>
                <input
                  type="text"
                  value={settings.academicYear}
                  onChange={(e) => setSettings({ ...settings, academicYear: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Prag prolaznosti eksterne mature (%)</label>
                <input
                  type="number"
                  min={30}
                  max={80}
                  value={settings.passingThresholdPercent}
                  onChange={(e) => setSettings({ ...settings, passingThresholdPercent: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Direktor škole</label>
                <input
                  type="text"
                  value={settings.schoolDirector}
                  onChange={(e) => setSettings({ ...settings, schoolDirector: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Predsjednik ispitne komisije</label>
                <input
                  type="text"
                  value={settings.commissionPresident}
                  onChange={(e) => setSettings({ ...settings, commissionPresident: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4" />
                Sačuvaj izmjene postavki
              </button>
            </div>
          </form>
        </div>
      )}

      {/* User Management & Role-Based Access Control */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Upravljanje korisničkim nalozima i ulogama (RBAC)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direktorska dodjela uloga: Učenik, Nastavnik/Pedagog/Ispitni odbor (Admin), Direktor (Superadmin)
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500">Ukupno naloga: {users.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Ime i prezime</th>
                <th className="py-3 px-4">E-mail adresa</th>
                <th className="py-3 px-4">Odjeljenje / Identifikator</th>
                <th className="py-3 px-4">Uloga u sistemu</th>
                <th className="py-3 px-4">Status naloga</th>
                <th className="py-3 px-4 text-right">Akcije</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{u.fullName}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{u.email}</td>
                  <td className="py-3.5 px-4 text-slate-500">
                    {u.className || u.studentIdNumber || 'Nastavno osoblje'}
                  </td>
                  <td className="py-3.5 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value as UserRole)}
                      className="p-1 rounded border border-slate-200 text-xs bg-slate-50 font-medium cursor-pointer"
                    >
                      <option value="student">Učenik</option>
                      <option value="admin">Nastavnik / Pedagog</option>
                      <option value="superadmin">Direktor (Superadmin)</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        u.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {u.status === 'active' ? 'Aktivan' : 'Suspendovan'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleStatusToggle(u.id, u.status)}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      {u.status === 'active' ? 'Deaktiviraj' : 'Aktiviraj'}
                    </button>
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
