import React, { useState, useEffect } from 'react';
import { Question, Subject, QuestionCategory, QuestionDifficulty, CognitiveDomain } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTranslation } from '../../i18n/index.tsx';
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Edit3,
  Tag,
  FolderTree,
  ChevronRight,
  Layers,
  Check,
  AlertCircle,
} from 'lucide-react';

export const QuestionBankManager: React.FC = () => {
  const { t } = useTranslation();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [categories, setCategories] = useState<QuestionCategory[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [difficulty, setDifficulty] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Modals
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // Question Form State
  const [formData, setFormData] = useState({
    subjectId: '',
    topic: '',
    categoryId: '',
    tagsString: '',
    questionText: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    correctOptionId: 'A',
    points: 2,
    difficulty: 'intermediate' as QuestionDifficulty,
    cognitiveDomain: 'comprehension' as CognitiveDomain,
    explanation: '',
  });

  // Category Form State
  const [catFormData, setCatFormData] = useState({
    subjectId: '',
    name: '',
    parentId: '',
    description: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [subData, catData, tagData] = await Promise.all([
        api.getSubjects(),
        api.getCategories(),
        api.getTags(),
      ]);
      setSubjects(subData);
      setCategories(catData);
      setAllTags(tagData);

      if (subData.length > 0 && !selectedSubject) {
        setSelectedSubject(subData[0].id);
      }
    } catch (err) {
      console.error('Greška pri učitavanju baze pitanja:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestions = async () => {
    try {
      const qList = await api.getQuestions({
        subjectId: selectedSubject || undefined,
        categoryId: selectedCategory || undefined,
        tag: selectedTag || undefined,
        difficulty: difficulty || undefined,
        domain: domain || undefined,
        search: search || undefined,
      });
      setQuestions(qList);
    } catch (err) {
      console.error('Greška pri dohvatanju pitanja:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [selectedSubject, selectedCategory, selectedTag, difficulty, domain, search]);

  const handleOpenNewQuestion = () => {
    setEditingQuestion(null);
    setFormData({
      subjectId: selectedSubject || (subjects[0]?.id || 'sub-mat'),
      topic: '',
      categoryId: '',
      tagsString: '',
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctOptionId: 'A',
      points: 2,
      difficulty: 'intermediate',
      cognitiveDomain: 'comprehension',
      explanation: '',
    });
    setShowQuestionModal(true);
  };

  const handleOpenEditQuestion = (q: Question) => {
    setEditingQuestion(q);
    setFormData({
      subjectId: q.subjectId,
      topic: q.topic,
      categoryId: q.categoryId || '',
      tagsString: q.tags ? q.tags.join(', ') : '',
      questionText: q.questionText,
      optionA: q.options[0]?.text || '',
      optionB: q.options[1]?.text || '',
      optionC: q.options[2]?.text || '',
      optionD: q.options[3]?.text || '',
      correctOptionId: q.correctOptionId,
      points: q.points,
      difficulty: q.difficulty,
      cognitiveDomain: q.cognitiveDomain,
      explanation: q.explanation,
    });
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedTags = formData.tagsString
        .split(',')
        .map((s) => s.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-'))
        .filter(Boolean);

      const options = [
        { id: 'A', text: formData.optionA },
        { id: 'B', text: formData.optionB },
        { id: 'C', text: formData.optionC },
        { id: 'D', text: formData.optionD },
      ];

      const selectedCat = categories.find((c) => c.id === formData.categoryId);

      const payload = {
        subjectId: formData.subjectId,
        topic: formData.topic || selectedCat?.name || 'Opšte gradivo',
        categoryId: formData.categoryId || undefined,
        categoryPath: selectedCat ? selectedCat.path : [formData.topic || 'Opšte'],
        tags: parsedTags,
        questionText: formData.questionText,
        options,
        correctOptionId: formData.correctOptionId,
        points: Number(formData.points),
        difficulty: formData.difficulty,
        cognitiveDomain: formData.cognitiveDomain,
        explanation: formData.explanation,
      };

      if (editingQuestion) {
        await api.updateQuestion(editingQuestion.id, payload);
      } else {
        await api.createQuestion(payload);
      }

      setShowQuestionModal(false);
      await loadQuestions();
      const updatedTags = await api.getTags();
      setAllTags(updatedTags);
    } catch (err: any) {
      alert(err.message || 'Greška pri spremanju pitanja.');
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (confirm('Da li ste sigurni da želite trajno ukloniti ovo ispitno pitanje?')) {
      await api.deleteQuestion(id);
      await loadQuestions();
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCategory({
        subjectId: catFormData.subjectId || selectedSubject,
        name: catFormData.name,
        parentId: catFormData.parentId || undefined,
        description: catFormData.description,
      });
      setShowCategoryModal(false);
      const catData = await api.getCategories();
      setCategories(catData);
      setCatFormData({ subjectId: '', name: '', parentId: '', description: '' });
    } catch (err: any) {
      alert(err.message || 'Greška pri kreiranju kategorije.');
    }
  };

  const filteredCategoriesForSubject = categories.filter(
    (c) => !selectedSubject || c.subjectId === selectedSubject
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {t('questions.title')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('questions.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCatFormData((prev) => ({ ...prev, subjectId: selectedSubject || subjects[0]?.id || '' }));
              setShowCategoryModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
            {t('questions.newCategory')}
          </button>
          <button
            onClick={handleOpenNewQuestion}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t('questions.newQuestion')}
          </button>
        </div>
      </div>

      {/* Main Grid: Left Category Hierarchy & Tags Filter + Right Question Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Hierarchical Taxonomy & Tags */}
        <div className="space-y-6 lg:col-span-1">
          {/* Category Tree Navigation */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-indigo-600" />
                {t('questions.categoryTree')}
              </span>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory('')}
                  className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
                >
                  Poništi
                </button>
              )}
            </div>

            <div className="space-y-1 text-xs">
              <button
                onClick={() => setSelectedCategory('')}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  selectedCategory === ''
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t('questions.allCategories')}
              </button>
              {filteredCategoriesForSubject.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                const indent = (cat.path.length - 1) * 12;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{ paddingLeft: `${Math.max(10, indent + 10)}px` }}
                    className={`w-full text-left py-1.5 pr-2 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {cat.path.length > 1 && <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />}
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags Cloud */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-100 pb-2">
              <span className="flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-indigo-600" />
                {t('questions.tags')}
              </span>
              {selectedTag && (
                <button
                  onClick={() => setSelectedTag('')}
                  className="text-[11px] text-indigo-600 hover:underline cursor-pointer"
                >
                  Poništi
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedTag('')}
                className={`px-2 py-1 rounded-md text-[11px] font-mono cursor-pointer transition-colors ${
                  selectedTag === ''
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                #sve
              </button>
              {allTags.map((tag) => {
                const isSelected = selectedTag === tag;
                return (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag === selectedTag ? '' : tag)}
                    className={`px-2 py-1 rounded-md text-[11px] font-mono cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    #{tag}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 3 Columns: Filter bar + Questions list */}
        <div className="space-y-4 lg:col-span-3">
          {/* Quick Filter Row */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Predmet</label>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedCategory('');
                }}
                className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
              >
                <option value="">Svi predmeti</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">{t('questions.difficulty')}</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
              >
                <option value="">Svi nivoi</option>
                <option value="basic">Osnovni nivo</option>
                <option value="intermediate">Srednji nivo</option>
                <option value="advanced">Napredni nivo</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">{t('questions.cognitiveDomain')}</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
              >
                <option value="">Sve domene</option>
                <option value="knowledge">Poznavanje činjenica</option>
                <option value="comprehension">Razumijevanje</option>
                <option value="application">Primjena znanja</option>
                <option value="analysis">Analiza i sinteza</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pretraga</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t('questions.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full p-2 pl-8 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>
                Pronađeno zadataka: <strong className="font-mono text-slate-800">{questions.length}</strong>
              </span>
              {(selectedCategory || selectedTag) && (
                <div className="flex items-center gap-2">
                  {selectedCategory && (
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[11px]">
                      Kategorija: {categories.find((c) => c.id === selectedCategory)?.name}
                    </span>
                  )}
                  {selectedTag && (
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-mono">
                      #{selectedTag}
                    </span>
                  )}
                </div>
              )}
            </div>

            {questions.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-3"
              >
                {/* Meta header */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 font-mono">#{idx + 1}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-indigo-700">
                      {q.categoryPath ? q.categoryPath.join(' > ') : q.topic}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">
                      {q.difficulty === 'basic' ? 'Osnovni' : q.difficulty === 'intermediate' ? 'Srednji' : 'Napredni'}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-600 font-semibold">{q.points} bod(a)</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditQuestion(q)}
                      className="p-1 text-slate-500 hover:text-indigo-600 rounded hover:bg-slate-100 cursor-pointer"
                      title="Uredi"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1 text-slate-500 hover:text-rose-600 rounded hover:bg-slate-100 cursor-pointer"
                      title="Obriši"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Question text */}
                <div className="text-sm font-medium text-slate-900 leading-relaxed">
                  {q.questionText}
                </div>

                {/* Options grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {q.options.map((opt) => {
                    const isCorrect = q.correctOptionId === opt.id;
                    return (
                      <div
                        key={opt.id}
                        className={`p-2 rounded-lg border flex items-center justify-between ${
                          isCorrect
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold'
                            : 'bg-slate-50/50 border-slate-200 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold">{opt.id})</span>
                          <span>{opt.text}</span>
                        </div>
                        {isCorrect && (
                          <span className="text-[10px] uppercase font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                            Tačno
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Tags & Explanation */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex flex-wrap items-center gap-1">
                    {q.tags && q.tags.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTag(t)}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono hover:bg-slate-200 cursor-pointer"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>

                  {q.authorName && (
                    <div className="text-[11px] text-slate-400">
                      Autor: {q.authorName}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Add/Edit Question */}
      {showQuestionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {editingQuestion ? 'Uredi ispitno pitanje' : t('questions.newQuestion')}
              </h2>
              <button onClick={() => setShowQuestionModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Predmet *</label>
                  <select
                    value={formData.subjectId}
                    onChange={(e) => setFormData({ ...formData, subjectId: e.target.value, categoryId: '' })}
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                    required
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hijerarhijska kategorija</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  >
                    <option value="">Odaberi kategoriju...</option>
                    {categories
                      .filter((c) => c.subjectId === formData.subjectId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.path.join(' > ')}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Oznake (Tags - odvojeno zarezom) *</label>
                <input
                  type="text"
                  placeholder="npr. algebra, kvadratne-jednačine, završni-rok, bez-kalkulatora"
                  value={formData.tagsString}
                  onChange={(e) => setFormData({ ...formData, tagsString: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tekst zadatka *</label>
                <textarea
                  rows={3}
                  value={formData.questionText}
                  onChange={(e) => setFormData({ ...formData, questionText: e.target.value })}
                  placeholder="Unesite formulaciju ispitnog pitanja..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  required
                />
              </div>

              {/* Options */}
              <div className="space-y-2">
                <label className="block font-semibold text-slate-700">Ponuđeni odgovori (A, B, C, D) *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-600">A)</span>
                    <input
                      type="text"
                      value={formData.optionA}
                      onChange={(e) => setFormData({ ...formData, optionA: e.target.value })}
                      placeholder="Opcija A"
                      className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-600">B)</span>
                    <input
                      type="text"
                      value={formData.optionB}
                      onChange={(e) => setFormData({ ...formData, optionB: e.target.value })}
                      placeholder="Opcija B"
                      className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-600">C)</span>
                    <input
                      type="text"
                      value={formData.optionC}
                      onChange={(e) => setFormData({ ...formData, optionC: e.target.value })}
                      placeholder="Opcija C"
                      className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-600">D)</span>
                    <input
                      type="text"
                      value={formData.optionD}
                      onChange={(e) => setFormData({ ...formData, optionD: e.target.value })}
                      placeholder="Opcija D"
                      className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Attributes row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tačan odgovor</label>
                  <select
                    value={formData.correctOptionId}
                    onChange={(e) => setFormData({ ...formData, correctOptionId: e.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono font-bold"
                  >
                    <option value="A">Opcija A</option>
                    <option value="B">Opcija B</option>
                    <option value="C">Opcija C</option>
                    <option value="D">Opcija D</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Bodovi</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formData.points}
                    onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Težina</label>
                  <select
                    value={formData.difficulty}
                    onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as QuestionDifficulty })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  >
                    <option value="basic">Osnovni</option>
                    <option value="intermediate">Srednji</option>
                    <option value="advanced">Napredni</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kognitivni nivo</label>
                  <select
                    value={formData.cognitiveDomain}
                    onChange={(e) => setFormData({ ...formData, cognitiveDomain: e.target.value as CognitiveDomain })}
                    className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  >
                    <option value="knowledge">Znanje</option>
                    <option value="comprehension">Razumijevanje</option>
                    <option value="application">Primjena</option>
                    <option value="analysis">Analiza</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Metodičko objašnjenje i rješenje</label>
                <textarea
                  rows={2}
                  value={formData.explanation}
                  onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                  placeholder="Kratak opis postupka i obrazloženje tačnog odgovora..."
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowQuestionModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  Sačuvaj pitanje
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Category */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-xs">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{t('questions.newCategory')}</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Predmet *</label>
                <select
                  value={catFormData.subjectId}
                  onChange={(e) => setCatFormData({ ...catFormData, subjectId: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  required
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nadređena kategorija (opciono)</label>
                <select
                  value={catFormData.parentId}
                  onChange={(e) => setCatFormData({ ...catFormData, parentId: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                >
                  <option value="">Glavna kategorija (korijen)</option>
                  {categories
                    .filter((c) => c.subjectId === catFormData.subjectId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.path.join(' > ')}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Naziv nove kategorije *</label>
                <input
                  type="text"
                  placeholder="npr. Kvadratne jednačine, Geometrija u prostoru"
                  value={catFormData.name}
                  onChange={(e) => setCatFormData({ ...catFormData, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opis (opciono)</label>
                <input
                  type="text"
                  value={catFormData.description}
                  onChange={(e) => setCatFormData({ ...catFormData, description: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Odustani
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer"
                >
                  Kreiraj kategoriju
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
