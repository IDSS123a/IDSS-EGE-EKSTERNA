import React, { useState, useEffect } from 'react';
import { StudentAccommodation, User, AccommodationType } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import { Plus, HeartHandshake, CheckCircle2, Shield, AlertTriangle } from 'lucide-react';

export const AccommodationsManager: React.FC = () => {
  const { t } = useTranslation();
  const [accommodations, setAccommodations] = useState<StudentAccommodation[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    studentId: '',
    type: 'extra_time_25' as AccommodationType,
    legalBasis: 'Član 14. stav 2. Pravilnika o inkluzivnom obrazovanju',
    description: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [accs, allUsers] = await Promise.all([
        api.getAccommodations(),
        api.getUsers(),
      ]);
      setAccommodations(accs);
      const studentList = allUsers.filter((u) => u.role === 'student');
      setStudents(studentList);
      if (studentList.length > 0 && !formData.studentId) {
        setFormData((prev) => ({ ...prev, studentId: studentList[0].id }));
      }
    } catch (err) {
      console.error('Greška pri učitavanju prilagodbi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await api.createAccommodation(formData);
      setShowModal(false);
      setFormData({
        studentId: students[0]?.id || '',
        type: 'extra_time_25',
        legalBasis: 'Član 14. stav 2. Pravilnika o inkluzivnom obrazovanju',
        description: '',
      });
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Greška pri evidentiranju prilagodbe.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('monitoring.accommodationsTitle')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Evidencija rješenja o prilagodbi ispitne procedure za učenike sa teškoćama i posebnim obrazovnim potrebama
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('monitoring.newAccommodation')}
        </button>
      </div>

      {/* Legal banner */}
      <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-950 text-xs leading-relaxed flex items-start gap-3">
        <Shield className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Zakonski okvir za inkluzivno polaganje u osnovnoj školi:</span> Prema članu 33. Zakona o osnovnom odgoju i obrazovanju Kantona Sarajevo i članu 14. Pravilnika o polaganju eksterne mature u osnovnim školama, pedagoško-psihološka služba IDSS obavezna je osigurati jednake mogućnosti za sve kandidate IX razreda putem individualiziranih ispitnih prilagodbi (produženo vrijeme do 50%, prilagođeni format A3/16pt, asistivna tehnologija).
        </div>
      </div>

      {/* Accommodations Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Aktivna pedagoška rješenja</h2>
          <span className="text-xs font-mono text-slate-500">Ukupno učenika: {accommodations.length}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {accommodations.map((acc) => (
            <div key={acc.id} className="p-5 hover:bg-slate-50/60 transition-colors space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <HeartHandshake className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span className="font-bold text-slate-900 text-sm">{acc.studentName}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                    Odjeljenje: {acc.className}
                  </span>
                </div>
                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-sm">
                  {acc.typeLabel}
                </span>
              </div>

              <div className="text-xs text-slate-600 pl-6 space-y-1">
                <div>
                  <strong className="text-slate-700">Pravni osnov:</strong> {acc.legalBasis}
                </div>
                <div>
                  <strong className="text-slate-700">Opis prilagodbe:</strong> {acc.description}
                </div>
                <div className="text-[11px] text-slate-400 pt-1">
                  Odobrio: {acc.approvedBy} · Datum rješenja: {new Date(acc.approvedAt).toLocaleDateString('bs')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Nova pedagoška prilagodba</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Učenik *</label>
                <select
                  value={formData.studentId}
                  onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  required
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.className || 'IX-1 (9a)'}) - {st.studentIdNumber}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Vrsta prilagodbe *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as AccommodationType })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                >
                  <option value="extra_time_25">Dodatno vrijeme za rad (+25%)</option>
                  <option value="extra_time_50">Dodatno vrijeme za rad (+50%)</option>
                  <option value="large_font">Prilagođeni font i format (A3 / 16pt)</option>
                  <option value="personal_assistant">Prisustvo personalnog asistenta</option>
                  <option value="adapted_room">Posebna prostorija za polaganje</option>
                  <option value="special_devices">Upotreba asistivne tehnologije</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pravni osnov (član Pravilnika/nalaz komisije) *</label>
                <input
                  type="text"
                  value={formData.legalBasis}
                  onChange={(e) => setFormData({ ...formData, legalBasis: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Detaljan opis i uputstvo za komisiju *</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Navedite precizne upute za dežurne nastavnike..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  {loading ? 'Spremanje...' : 'Evidentiraj prilagodbu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
