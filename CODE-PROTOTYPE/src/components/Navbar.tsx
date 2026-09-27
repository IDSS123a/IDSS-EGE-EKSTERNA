import React, { useState } from 'react';
import { User, UserRole } from '../types/index.ts';
import { useTranslation, SupportedLanguage } from '../i18n/index.tsx';
import { ShieldCheck, UserCheck, GraduationCap, Building2, BookOpen, Layers, Globe, ChevronDown, Trophy, Flame, Brain, Sparkles } from 'lucide-react';

interface NavbarProps {
  currentUser: User;
  onSelectRole: (role: UserRole) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenAuth: () => void;
  onOpenArchitecture: () => void;
  onOpenGeminiChat?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  onSelectRole,
  activeTab,
  setActiveTab,
  onOpenAuth,
  onOpenArchitecture,
  onOpenGeminiChat,
}) => {
  const { t, language, setLanguage } = useTranslation();
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs no-print">
      {/* Top institution banner line */}
      <div className="bg-slate-900 text-slate-300 text-xs px-4 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-100">{t('app.subtitle')}</span>
          <span className="hidden sm:inline text-slate-500">·</span>
          <span className="hidden sm:inline text-slate-400">{t('app.ministry')}</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-800"
              title={t('lang.select')}
            >
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span className="uppercase font-mono font-medium">{language}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 text-xs text-slate-800">
                <button
                  onClick={() => {
                    setLanguage('bs');
                    setLangMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between ${
                    language === 'bs' ? 'font-bold text-indigo-700 bg-indigo-50/50' : ''
                  }`}
                >
                  <span>Bosanski (B/S/C)</span>
                  {language === 'bs' && <span>✓</span>}
                </button>
                <button
                  onClick={() => {
                    setLanguage('de');
                    setLangMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between ${
                    language === 'de' ? 'font-bold text-indigo-700 bg-indigo-50/50' : ''
                  }`}
                >
                  <span>Deutsch</span>
                  {language === 'de' && <span>✓</span>}
                </button>
                <button
                  onClick={() => {
                    setLanguage('en');
                    setLangMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between ${
                    language === 'en' ? 'font-bold text-indigo-700 bg-indigo-50/50' : ''
                  }`}
                >
                  <span>English</span>
                  {language === 'en' && <span>✓</span>}
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onOpenArchitecture}
            className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-white transition-colors cursor-pointer"
            title="Prikaz arhitekture steka i baze podataka"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="font-medium hidden sm:inline">{t('app.techStack')}</span>
          </button>
          {onOpenGeminiChat && (
            <button
              onClick={onOpenGeminiChat}
              className="flex items-center gap-1.5 text-xs text-amber-300 hover:text-white transition-colors cursor-pointer bg-slate-800/90 hover:bg-slate-700 px-2 py-0.5 rounded-md border border-amber-400/30"
              title="Otvori IDSS Asistent (RAG Baza Znanja)"
            >
              <img
                src="https://idss.edu.ba/wp-content/uploads/2024/03/logo_white.png"
                alt="IDSS"
                className="w-3.5 h-3.5 object-contain"
              />
              <span className="font-semibold hidden sm:inline">IDSS Asistent</span>
            </button>
          )}
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400 font-mono text-[11px] tabular-nums">{t('app.academicYear')}</span>
        </div>
      </div>

      {/* Main Top Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark / brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 p-1 flex items-center justify-center shrink-0 shadow-xs">
            <img
              src="https://idss.edu.ba/wp-content/uploads/2024/03/logo_white.png"
              alt="Internationale Deutsche Schule Sarajevo"
              className="w-full h-full object-contain"
            />
          </div>
          <button
            onClick={() => setActiveTab(currentUser.role === 'student' ? 'student-dashboard' : currentUser.role === 'admin' ? 'admin-questions' : 'superadmin-dashboard')}
            className="text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-slate-900 text-base sm:text-lg group-hover:text-indigo-700 transition-colors">
                {t('app.title')}
              </span>
              <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 tracking-wide">
                IX razred · 9. Klasse
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium">
              {t('app.subtitle')}
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Clean text links based on active role) */}
        <nav className="hidden xl:flex items-center gap-6 text-sm font-medium text-slate-600">
          {currentUser.role === 'student' && (
            <>
              <button
                onClick={() => setActiveTab('student-dashboard')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'student-dashboard'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.dashboard')}
              </button>
              <button
                onClick={() => setActiveTab('student-simulator')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'student-simulator'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.simulator')}
              </button>
              <button
                onClick={() => setActiveTab('student-practice')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'student-practice'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.practice')}
              </button>
              <button
                onClick={() => setActiveTab('student-ai-tutor')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'student-ai-tutor'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Brain className="w-3.5 h-3.5 text-indigo-600" />
                <span>{t('nav.aiTutor')}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-indigo-100 text-indigo-700">
                  AI
                </span>
              </button>
              <button
                onClick={() => setActiveTab('student-badges')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'student-badges'
                    ? 'border-amber-500 text-amber-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                <span>{t('nav.badges')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              </button>
              <button
                onClick={() => setActiveTab('student-analytics')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'student-analytics'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.analytics')}
              </button>
              <button
                onClick={() => setActiveTab('student-rules')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'student-rules'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.rules')}
              </button>
            </>
          )}

          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('admin-config')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'admin-config'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.examConfig')}
              </button>
              <button
                onClick={() => setActiveTab('admin-questions')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'admin-questions'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.questions')}
              </button>
              <button
                onClick={() => setActiveTab('admin-monitoring')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'admin-monitoring'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.monitoring')}
              </button>
              <button
                onClick={() => setActiveTab('admin-accommodations')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'admin-accommodations'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.accommodations')}
              </button>
              <button
                onClick={() => setActiveTab('admin-documents')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'admin-documents'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.documents')}
              </button>
            </>
          )}

          {currentUser.role === 'superadmin' && (
            <>
              <button
                onClick={() => setActiveTab('superadmin-dashboard')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'superadmin-dashboard'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.directorDashboard')}
              </button>
              <button
                onClick={() => setActiveTab('admin-config')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'admin-config'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.examConfig')}
              </button>
              <button
                onClick={() => setActiveTab('superadmin-compliance')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'superadmin-compliance'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.compliance')}
              </button>
              <button
                onClick={() => setActiveTab('superadmin-audit')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'superadmin-audit'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.audit')}
              </button>
              <button
                onClick={() => setActiveTab('superadmin-users')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'superadmin-users'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.usersAndSettings')}
              </button>
              <button
                onClick={() => setActiveTab('admin-documents')}
                className={`transition-colors pb-1 border-b-2 cursor-pointer ${
                  activeTab === 'admin-documents'
                    ? 'border-indigo-600 text-indigo-700 font-semibold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {t('nav.documents')}
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: Interactive Role Switcher & User Profile */}
        <div className="flex items-center gap-3">
          {/* Quick Role Switcher */}
          <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium px-2">{t('app.role')}:</span>
            <button
              onClick={() => onSelectRole('student')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                currentUser.role === 'student'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('app.role.student')}
            </button>
            <button
              onClick={() => onSelectRole('admin')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                currentUser.role === 'admin'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('app.role.admin')}
            </button>
            <button
              onClick={() => onSelectRole('superadmin')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                currentUser.role === 'superadmin'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('app.role.superadmin')}
            </button>
          </div>

          {/* User profile dropdown button */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-xs text-slate-800 font-medium cursor-pointer"
          >
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs">
              {currentUser.fullName.charAt(0)}
            </div>
            <div className="text-left hidden sm:block">
              <div className="font-semibold leading-tight">{currentUser.fullName}</div>
              <div className="text-[10px] text-slate-500 capitalize">
                {currentUser.role === 'student'
                  ? `${t('app.role.student')} (${currentUser.className || 'IX-1 (9a)'})`
                  : currentUser.role === 'admin'
                  ? t('app.role.admin')
                  : t('app.role.superadmin')}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Sub-navigation bar for tablet and mobile screens */}
      <div className="xl:hidden border-t border-slate-200/80 bg-slate-50/90 px-4 sm:px-6 overflow-x-auto py-2">
        <nav className="flex items-center gap-2 text-xs font-medium text-slate-600 min-w-max">
          {currentUser.role === 'student' && (
            <>
              <button
                onClick={() => setActiveTab('student-dashboard')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'student-dashboard'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.dashboard')}
              </button>
              <button
                onClick={() => setActiveTab('student-simulator')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'student-simulator'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.simulator')}
              </button>
              <button
                onClick={() => setActiveTab('student-practice')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'student-practice'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.practice')}
              </button>
              <button
                onClick={() => setActiveTab('student-ai-tutor')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'student-ai-tutor'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-900 font-medium'
                }`}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>{t('nav.aiTutor')}</span>
              </button>
              <button
                onClick={() => setActiveTab('student-badges')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'student-badges'
                    ? 'bg-amber-500 text-white font-bold shadow-xs'
                    : 'bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>{t('nav.badges')}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              </button>
              <button
                onClick={() => setActiveTab('student-analytics')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'student-analytics'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.analytics')}
              </button>
              <button
                onClick={() => setActiveTab('student-rules')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'student-rules'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.rules')}
              </button>
            </>
          )}

          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('admin-config')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'admin-config'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.examConfig')}
              </button>
              <button
                onClick={() => setActiveTab('admin-questions')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'admin-questions'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.questionBank')}
              </button>
              <button
                onClick={() => setActiveTab('admin-monitoring')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'admin-monitoring'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.monitoring')}
              </button>
              <button
                onClick={() => setActiveTab('admin-accommodations')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'admin-accommodations'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.accommodations')}
              </button>
              <button
                onClick={() => setActiveTab('admin-documents')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'admin-documents'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.documents')}
              </button>
            </>
          )}

          {currentUser.role === 'superadmin' && (
            <>
              <button
                onClick={() => setActiveTab('superadmin-dashboard')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'superadmin-dashboard'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.executive')}
              </button>
              <button
                onClick={() => setActiveTab('admin-config')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'admin-config'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.examConfig')}
              </button>
              <button
                onClick={() => setActiveTab('superadmin-compliance')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'superadmin-compliance'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.compliance')}
              </button>
              <button
                onClick={() => setActiveTab('superadmin-audit')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'superadmin-audit'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.audit')}
              </button>
              <button
                onClick={() => setActiveTab('superadmin-users')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'superadmin-users'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.settings')}
              </button>
              <button
                onClick={() => setActiveTab('admin-documents')}
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeTab === 'admin-documents'
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                {t('nav.documents')}
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};
