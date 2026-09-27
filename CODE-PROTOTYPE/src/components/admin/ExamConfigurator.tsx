import React, { useState, useEffect } from 'react';
import { ExamSession, Subject, QuestionCategory } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  Settings,
  Plus,
  Trash2,
  CheckCircle,
  HelpCircle,
  Sparkles,
  Layers,
  Tag,
  AlertCircle,
  Eye,
} from 'lucide-react';

export const ExamConfigurator: React.FC = () => {
  const { t } = useTranslation();
  const [exams, setExams] = useState<ExamSession[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [poolPreview, setPoolPreview] = useState<{ examId: string; totalMatched: number; sample: any[] } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subjectId: '',
    examDate: '2026-06-20',
    startTime: '09:00',
    endDate: '2026-06-20',
    endTime: '11:00',
    durationMinutes: 90,
    roomNumber: 'Učionica 101',
    location: 'Centralna zgrada škole',
    maxCandidates: 30,
    president: 'Prof. dr. Ismar Hadžiosmanović',
    supervisor1: 'Prof. Amra Softić',
    supervisor2: 'Prof. Denis Karić',
    evaluator: 'Predmetni nastavnik',
    selectedCategories: [] as string[],
    selectedTags: [] as string[],
    basicPct: 40,
    intermediatePct: 40,
    advancedPct: 20,
    questionCount: 20,
    shuffleQuestions: true,
    passingThresholdPercent: 50,
    calculatorAllowed: false,
    formulaSheetAllowed: false,
    penaltyForWrongAnswers: false,
    allowedTools: 'Plava hemijska olovka, Lična karta sa fotografijom',
    notes: 'Kandidati moraju biti prisutni 30 minuta prije početka.',
  });

  const loadAll = async () => {
    try {
      setLoading(true);
      const [exData, subData, catData, tagData] = await Promise.all([
        api.getExams(),
        api.getSubjects(),
        api.getCategories(),
        api.getTags(),
      ]);
      setExams(exData);
      setSubjects(subData);
      setCategories(catData);
      setAllTags(tagData);
      if (subData.length > 0 && !formData.subjectId) {
        setFormData((prev) => ({ ...prev, subjectId: subData[0].id }));
      }
    } catch (err) {
      console.error('Greška pri učitavanju konfiguracije ispita:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleSubjectChange = (subId: string) => {
    const sub = subjects.find((s) => s.id === subId);
    setFormData((prev) => ({
      ...prev,
      subjectId: subId,
      title: `Eksterna matura: ${sub?.name || 'Predmet'}`,
      durationMinutes: sub?.durationMinutes || 90,
      selectedCategories: [],
    }));
  };

  const handleToggleCategory = (catName: string) => {
    setFormData((prev) => {
      const exists = prev.selectedCategories.includes(catName);
      return {
        ...prev,
        selectedCategories: exists
          ? prev.selectedCategories.filter((c) => c !== catName)
          : [...prev.selectedCategories, catName],
      };
    });
  };

  const handleToggleTag = (tag: string) => {
    setFormData((prev) => {
      const exists = prev.selectedTags.includes(tag);
      return {
        ...prev,
        selectedTags: exists
          ? prev.selectedTags.filter((t) => t !== tag)
          : [...prev.selectedTags, tag],
      };
    });
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const payload: Partial<ExamSession> = {
        title: formData.title,
        description: formData.description,
        subjectId: formData.subjectId,
        examDate: formData.examDate,
        startTime: formData.startTime,
        endDate: formData.endDate,
        endTime: formData.endTime,
        durationMinutes: Number(formData.durationMinutes),
        roomNumber: formData.roomNumber,
        location: formData.location,
        maxCandidates: Number(formData.maxCandidates),
        commission: {
          president: formData.president,
          supervisor1: formData.supervisor1,
          supervisor2: formData.supervisor2,
          evaluator: formData.evaluator,
        },
        poolConfig: {
          categories: formData.selectedCategories,
          tags: formData.selectedTags,
          difficultyDistribution: {
            basic: Number(formData.basicPct),
            intermediate: Number(formData.intermediatePct),
            advanced: Number(formData.advancedPct),
          },
          questionCount: Number(formData.questionCount),
          shuffleQuestions: formData.shuffleQuestions,
        },
        rules: {
          passingThresholdPercent: Number(formData.passingThresholdPercent),
          calculatorAllowed: formData.calculatorAllowed,
          formulaSheetAllowed: formData.formulaSheetAllowed,
          penaltyForWrongAnswers: formData.penaltyForWrongAnswers,
          allowedTools: formData.allowedTools.split(',').map((s) => s.trim()).filter(Boolean),
          notes: formData.notes,
        },
        notes: formData.notes,
      };

      await api.createExam(payload);
      setShowModal(false);
      await loadAll();
    } catch (err: any) {
      alert(err.message || 'Greška pri spremanju konfiguracije ispita.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (confirm('Da li ste sigurni da želite ukloniti ovaj ispitni rok?')) {
      await api.deleteExam(id);
      await loadAll();
    }
  };

  const handlePreviewPool = async (examId: string) => {
    const res = await api.drawPoolPreview(examId);
    setPoolPreview({
      examId,
      totalMatched: res.totalMatchedInPool,
      sample: res.sampleQuestions || [],
    });
  };

  // Filter categories for currently selected subject
  const currentSubjectCategories = categories.filter((c) => c.subjectId === formData.subjectId);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('admin.config.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('admin.config.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          {t('admin.config.newExam')}
        </button>
      </div>

      {/* List of Configured Exams */}
      <div className="space-y-4">
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs hover:border-slate-300 transition-all space-y-4"
          >
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-sm">
                    {exam.subjectName}
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-sm capitalize">
                    {exam.status === 'scheduled' ? 'Planirano' : exam.status}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{exam.title}</h3>
                {exam.description && (
                  <p className="text-xs text-slate-500 leading-relaxed max-w-3xl">
                    {exam.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handlePreviewPool(exam.id)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                  title="Pregledaj pitanja u bazenu prema zadatim kriterijima"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                  Testiraj bazen pitanja
                </button>
                <button
                  onClick={() => handleDeleteExam(exam.id)}
                  className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                  title="Ukloni konfiguraciju"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Grid of parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
              <div className="space-y-1">
                <div className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Datum i satnica
                </div>
                <div className="font-semibold text-slate-800">
                  {exam.examDate} u {exam.startTime}h
                </div>
                <div className="text-[11px] text-slate-500">Trajanje: {exam.durationMinutes} min</div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> Lokacija & Kapacitet
                </div>
                <div className="font-semibold text-slate-800">{exam.roomNumber}</div>
                <div className="text-[11px] text-slate-500">Kapacitet: {exam.maxCandidates} kandidata</div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Layers className="w-3.5 h-3.5 text-slate-400" /> Kriterij bazena (Pool)
                </div>
                <div className="font-semibold text-slate-800">
                  {exam.poolConfig?.questionCount || 20} pitanja (Izvlačenje)
                </div>
                <div className="text-[11px] text-slate-500 truncate" title={exam.poolConfig?.categories?.join(', ') || 'Sve kategorije'}>
                  Kategorije: {exam.poolConfig?.categories?.length ? exam.poolConfig.categories.join(', ') : 'Sve'}
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Settings className="w-3.5 h-3.5 text-slate-400" /> Pravila & Prag
                </div>
                <div className="font-semibold text-slate-800">
                  Prag prolaznosti: {exam.rules?.passingThresholdPercent ?? 50}%
                </div>
                <div className="text-[11px] text-slate-500">
                  Kalkulator: {exam.rules?.calculatorAllowed ? 'Dozvoljen' : 'Zabranjen'}
                </div>
              </div>
            </div>

            {/* Tags required */}
            {exam.poolConfig?.tags && exam.poolConfig.tags.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Obavezne oznake (Tags):</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {exam.poolConfig.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-mono">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Commission footer */}
            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
              <div>
                <span className="font-medium text-slate-700">Predsjednik komisije:</span>{' '}
                {exam.commission.president} · <span className="font-medium text-slate-700">Dežurni:</span>{' '}
                {exam.commission.supervisor1}, {exam.commission.supervisor2}
              </div>
              <div className="text-slate-500 text-[11px]">
                Ocjenjivač: {exam.commission.evaluator}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pool Preview Modal */}
      {poolPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Pregled bazena pitanja (Question Pool)</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ukupno zadataka koji ispunjavaju kriterije: <strong className="font-mono text-indigo-700">{poolPreview.totalMatched}</strong>
                </p>
              </div>
              <button
                onClick={() => setPoolPreview(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                ✕ Zatvori
              </button>
            </div>

            <div className="space-y-3">
              {poolPreview.sample.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs">
                  Nema zadataka koji u potpunosti odgovaraju ovim kategorijama i oznakama.
                </div>
              ) : (
                poolPreview.sample.map((q, idx) => (
                  <div key={q.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-bold text-slate-700 font-mono">Zadatak #{idx + 1}</span>
                      <span>{q.topic} · Bodovi: {q.points}</span>
                    </div>
                    <div className="font-medium text-slate-900">{q.questionText}</div>
                    {q.tags && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {q.tags.map((t: string) => (
                          <span key={t} className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setPoolPreview(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium cursor-pointer"
              >
                U redu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Modal for Configuring / Scheduling an Exam */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{t('admin.config.newExam')}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Unos parametara ispitnog roka, pravila i kriterija za izvlačenje pitanja
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExam} className="space-y-6 text-xs">
              {/* Basic Exam Info */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  1. Osnovni podaci o ispitu
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ispitni predmet *</label>
                    <select
                      value={formData.subjectId}
                      onChange={(e) => handleSubjectChange(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs"
                      required
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Naziv ispita *</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Opis i cilj ispita</label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Svrha i obuhvat eksterne mature..."
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-xs"
                  />
                </div>
              </div>

              {/* Scheduling and Room Logistics */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                  2. Termini i prostorna logistika
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Datum polaganja</label>
                    <input
                      type="date"
                      value={formData.examDate}
                      onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Vrijeme početka</label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Trajanje (minuti)</label>
                    <input
                      type="number"
                      value={formData.durationMinutes}
                      onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Maks. kandidata</label>
                    <input
                      type="number"
                      value={formData.maxCandidates}
                      onChange={(e) => setFormData({ ...formData, maxCandidates: Number(e.target.value) })}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Ispitna sala / Učionica *</label>
                    <input
                      type="text"
                      value={formData.roomNumber}
                      onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Lokacija u školi</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Question Pool Configuration */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  3. Bazen pitanja i izvlačenje (Question Pool)
                </h3>

                {/* Categories Checkboxes */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Dozvoljene kategorije za izvlačenje (ostavite prazno za sve):
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {currentSubjectCategories.map((cat) => {
                      const isChecked = formData.selectedCategories.includes(cat.name);
                      return (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => handleToggleCategory(cat.name)}
                          className={`px-3 py-1 rounded-lg border text-xs transition-colors cursor-pointer ${
                            isChecked
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cat.path.join(' > ')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Required Tags Checkboxes */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">
                    Filtriranje po oznakama (Tags):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((tag) => {
                      const isChecked = formData.selectedTags.includes(tag);
                      return (
                        <button
                          type="button"
                          key={tag}
                          onClick={() => handleToggleTag(tag)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer border ${
                            isChecked
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          #{tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Difficulty distribution & Question Count */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-slate-600 mb-1">Ukupno pitanja</label>
                    <input
                      type="number"
                      value={formData.questionCount}
                      onChange={(e) => setFormData({ ...formData, questionCount: Number(e.target.value) })}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">% Osnovni</label>
                    <input
                      type="number"
                      value={formData.basicPct}
                      onChange={(e) => setFormData({ ...formData, basicPct: Number(e.target.value) })}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">% Srednji</label>
                    <input
                      type="number"
                      value={formData.intermediatePct}
                      onChange={(e) => setFormData({ ...formData, intermediatePct: Number(e.target.value) })}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">% Napredni</label>
                    <input
                      type="number"
                      value={formData.advancedPct}
                      onChange={(e) => setFormData({ ...formData, advancedPct: Number(e.target.value) })}
                      className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Specific Rules and Parameters */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-indigo-600" />
                  4. Pravila i parametri ispita
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.calculatorAllowed}
                      onChange={(e) => setFormData({ ...formData, calculatorAllowed: e.target.checked })}
                      className="rounded-sm"
                    />
                    <span className="font-medium text-slate-800">Dozvoljen kalkulator</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.formulaSheetAllowed}
                      onChange={(e) => setFormData({ ...formData, formulaSheetAllowed: e.target.checked })}
                      className="rounded-sm"
                    />
                    <span className="font-medium text-slate-800">Dozvoljena tablica formula</span>
                  </label>

                  <label className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.shuffleQuestions}
                      onChange={(e) => setFormData({ ...formData, shuffleQuestions: e.target.checked })}
                      className="rounded-sm"
                    />
                    <span className="font-medium text-slate-800">Nasumičan redoslijed pitanja</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Prag prolaznosti (%)</label>
                    <input
                      type="number"
                      value={formData.passingThresholdPercent}
                      onChange={(e) => setFormData({ ...formData, passingThresholdPercent: Number(e.target.value) })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dozvoljeni pribor (odvojeno zarezom)</label>
                    <input
                      type="text"
                      value={formData.allowedTools}
                      onChange={(e) => setFormData({ ...formData, allowedTools: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Commission Members */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  5. Imenovanje ispitne komisije
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Predsjednik komisije</label>
                    <input
                      type="text"
                      value={formData.president}
                      onChange={(e) => setFormData({ ...formData, president: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Predmetni ocjenjivač</label>
                    <input
                      type="text"
                      value={formData.evaluator}
                      onChange={(e) => setFormData({ ...formData, evaluator: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dežurni nastavnik 1</label>
                    <input
                      type="text"
                      value={formData.supervisor1}
                      onChange={(e) => setFormData({ ...formData, supervisor1: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Dežurni nastavnik 2</label>
                    <input
                      type="text"
                      value={formData.supervisor2}
                      onChange={(e) => setFormData({ ...formData, supervisor2: e.target.value })}
                      className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
                >
                  {t('btn.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs cursor-pointer"
                >
                  {loading ? 'Spremanje...' : t('admin.config.saveConfig')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
