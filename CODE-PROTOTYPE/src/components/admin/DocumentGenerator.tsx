import React, { useState, useEffect } from 'react';
import { GeneratedDocument, SchoolSettings, DocumentType } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import { OfficialDocumentView } from './OfficialDocumentView.tsx';
import { FileText, Printer, Plus, Eye, Calendar, Award, CheckCircle } from 'lucide-react';

export const DocumentGenerator: React.FC = () => {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<GeneratedDocument[]>([]);
  const [settings, setSettings] = useState<SchoolSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<GeneratedDocument | null>(null);

  // New doc generation form
  const [showModal, setShowModal] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('minutes');
  const [customTitle, setCustomTitle] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [docs, sett] = await Promise.all([
        api.getDocuments(),
        api.getSchoolSettings(),
      ]);
      setDocuments(docs);
      setSettings(sett);
    } catch (err) {
      console.error('Greška pri učitavanju dokumenata:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const defaultTitles: Record<DocumentType, string> = {
        minutes: 'Zapisnik o toku provođenja ispita',
        candidate_list: 'Spisak raspoređenih kandidata po ispitnim prostorijama',
        commission_resolution: 'Rješenje o imenovanju ispitne komisije i dežurnih nastavnika',
        results_summary: 'Zbirni izvještaj o postignutim rezultatima eksterne mature',
        certificate: 'Službeno Uvjerenje o položenoj eksternoj maturi',
      };

      const title = customTitle || defaultTitles[docType];
      const newDoc = await api.generateDocument(docType, title, {
        generatedFromUI: true,
      });

      setShowModal(false);
      setCustomTitle('');
      await loadData();
      setSelectedDoc(newDoc);
    } catch (err: any) {
      alert(err.message || 'Greška pri generisanju akta.');
    } finally {
      setLoading(false);
    }
  };

  if (selectedDoc && settings) {
    return (
      <OfficialDocumentView
        document={selectedDoc}
        settings={settings}
        onBack={() => setSelectedDoc(null)}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('docs.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('docs.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('docs.generate')}
        </button>
      </div>

      {/* Grid of Standard Administrative Templates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => {
            setDocType('minutes');
            setCustomTitle('Zapisnik o toku provođenja ispita');
            setShowModal(true);
          }}
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer space-y-2"
        >
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Zapisnik o toku ispita</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Službeni zapisnik ispitne komisije sa satnicom, preuzimanjem testova i tokom ispita.
          </p>
        </div>

        <div
          onClick={() => {
            setDocType('commission_resolution');
            setCustomTitle('Rješenje o imenovanju ispitne komisije');
            setShowModal(true);
          }}
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer space-y-2"
        >
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Award className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Rješenje o komisijama</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Pravno rješenje direktora o formiranju ispitnih komisija i dežurstvima.
          </p>
        </div>

        <div
          onClick={() => {
            setDocType('certificate');
            setCustomTitle('Službeno Uvjerenje o položenoj eksternoj maturi');
            setShowModal(true);
          }}
          className="p-5 rounded-xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-xs transition-all cursor-pointer space-y-2"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <CheckCircle className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">Uvjerenje / Certifikat</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Zvanično uvjerenje o položenoj eksternoj maturi sa ostvarenim bodovima i pečatom.
          </p>
        </div>
      </div>

      {/* Table of Generated Documents */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Arhiva službeno ovjerenih dokumenata</h2>
          <span className="text-xs text-slate-500 font-mono">Ukupno: {documents.length}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/60 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                    Broj: {doc.protocolNumber}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs text-slate-500">Šk. god: {doc.academicYear}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900">{doc.title}</h3>
                <div className="text-[11px] text-slate-400">
                  Generisao: {doc.generatedBy} · Datum: {new Date(doc.generatedAt).toLocaleDateString('bs')}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDoc(doc)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  Pregled & Štampa
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Generation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Kreiranje novog službenog akta</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tip dokumenta *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentType)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                >
                  <option value="minutes">Zapisnik o toku provođenja ispita</option>
                  <option value="candidate_list">Spisak kandidata po ispitnim prostorijama</option>
                  <option value="commission_resolution">Rješenje o imenovanju ispitne komisije</option>
                  <option value="results_summary">Zbirni izvještaj o rezultatima mature</option>
                  <option value="certificate">Službeno Uvjerenje / Certifikat za učenika</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Naslov akta (opciono)</label>
                <input
                  type="text"
                  placeholder="Ostavite prazno za standardni zakonski naslov..."
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-lg text-slate-600 text-[11px] leading-relaxed">
                Sistem će automatski dodijeliti jedinstveni broj protokola u formatu <strong className="font-mono">XX-XXX/26</strong>, povezati zakonski osnov i pripremiti akt za štampanje u A4 formatu.
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
                  {loading ? 'Generisanje...' : 'Generiši akt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
