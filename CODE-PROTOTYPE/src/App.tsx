import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types/index.ts';
import { api } from './services/api.ts';
import { LanguageProvider, useTranslation } from './i18n/index.tsx';
import { Navbar } from './components/Navbar.tsx';
import { StudentDashboard } from './components/student/StudentDashboard.tsx';
import { ExamSimulator } from './components/student/ExamSimulator.tsx';
import { QuestionPractice } from './components/student/QuestionPractice.tsx';
import { StudentAnalytics } from './components/student/StudentAnalytics.tsx';
import { StudentBadges } from './components/student/StudentBadges.tsx';
import { CandidateRules } from './components/student/CandidateRules.tsx';
import { ExamConfigurator } from './components/admin/ExamConfigurator.tsx';
import { QuestionBankManager } from './components/admin/QuestionBankManager.tsx';
import { StudentMonitoring } from './components/admin/StudentMonitoring.tsx';
import { AccommodationsManager } from './components/admin/AccommodationsManager.tsx';
import { DocumentGenerator } from './components/admin/DocumentGenerator.tsx';
import { ExecutiveDashboard } from './components/superadmin/ExecutiveDashboard.tsx';
import { ComplianceMatrix } from './components/superadmin/ComplianceMatrix.tsx';
import { AuditLogViewer } from './components/superadmin/AuditLogViewer.tsx';
import { SchoolSettingsManager } from './components/superadmin/SchoolSettingsManager.tsx';
import { StackArchitectureModal } from './components/StackArchitectureModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';

function MainApp() {
  const { t } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'user-student-1',
    email: 'amar.hadzic@ucenik.idss.ba',
    fullName: 'Amar Hadžić',
    role: 'student',
    status: 'active',
    className: 'IX-1 (9a)',
    studentIdNumber: 'IDSS-IX-2026-001',
    createdAt: new Date().toISOString(),
  });

  const [activeTab, setActiveTab] = useState<string>('student-dashboard');
  const [simulatorSubjectId, setSimulatorSubjectId] = useState<string>('sub-mat');
  const [practiceSubjectId, setPracticeSubjectId] = useState<string | undefined>(undefined);
  const [showArchitectureModal, setShowArchitectureModal] = useState<boolean>(false);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Synchronize api service active user
  useEffect(() => {
    api.setCurrentUserId(currentUser.id);
  }, [currentUser]);

  // Role Switcher Handler
  const handleSelectRole = (role: UserRole) => {
    if (role === 'student') {
      setCurrentUser({
        id: 'user-student-1',
        email: 'amar.hadzic@ucenik.idss.ba',
        fullName: 'Amar Hadžić',
        role: 'student',
        status: 'active',
        className: 'IX-1 (9a)',
        studentIdNumber: 'IDSS-IX-2026-001',
        createdAt: '2025-09-10T10:00:00Z',
      });
      setActiveTab('student-dashboard');
    } else if (role === 'admin') {
      setCurrentUser({
        id: 'user-admin-pedagog',
        email: 'pedagog@idss.ba',
        fullName: 'Prof. Lejla Babić',
        role: 'admin',
        status: 'active',
        phone: '+387 33 812-402',
        createdAt: '2025-09-01T08:30:00Z',
      });
      setActiveTab('admin-config');
    } else if (role === 'superadmin') {
      setCurrentUser({
        id: 'user-superadmin-1',
        email: 'direktor@idss.ba',
        fullName: 'Mag. Thomas Weber',
        role: 'superadmin',
        status: 'active',
        phone: '+387 33 812-401',
        createdAt: '2025-09-01T08:00:00Z',
      });
      setActiveTab('superadmin-dashboard');
    }
  };

  const handleStartSimulation = (subjectId: string) => {
    setSimulatorSubjectId(subjectId);
    setActiveTab('student-simulator');
  };

  const handleOpenPractice = (subjectId?: string) => {
    setPracticeSubjectId(subjectId);
    setActiveTab('student-practice');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        currentUser={currentUser}
        onSelectRole={handleSelectRole}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenArchitecture={() => setShowArchitectureModal(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* STUDENT VIEWS */}
        {activeTab === 'student-dashboard' && (
          <StudentDashboard
            currentUser={currentUser}
            onStartSimulation={handleStartSimulation}
            onOpenPractice={handleOpenPractice}
            onOpenRules={() => setActiveTab('student-rules')}
            onOpenAnalytics={() => setActiveTab('student-analytics')}
            onOpenBadges={() => setActiveTab('student-badges')}
          />
        )}

        {activeTab === 'student-simulator' && (
          <ExamSimulator
            initialSubjectId={simulatorSubjectId}
            onExit={() => setActiveTab('student-dashboard')}
            onOpenBadges={() => setActiveTab('student-badges')}
          />
        )}

        {activeTab === 'student-practice' && (
          <QuestionPractice
            initialSubjectId={practiceSubjectId}
            onOpenBadges={() => setActiveTab('student-badges')}
          />
        )}

        {activeTab === 'student-badges' && (
          <StudentBadges
            currentUser={currentUser}
            onStartSimulation={handleStartSimulation}
            onOpenPractice={handleOpenPractice}
          />
        )}

        {activeTab === 'student-analytics' && (
          <StudentAnalytics
            currentUser={currentUser}
            onOpenBadges={() => setActiveTab('student-badges')}
          />
        )}

        {activeTab === 'student-rules' && <CandidateRules />}

        {/* ADMIN VIEWS */}
        {activeTab === 'admin-config' && <ExamConfigurator />}

        {activeTab === 'admin-questions' && <QuestionBankManager />}

        {activeTab === 'admin-monitoring' && <StudentMonitoring />}

        {activeTab === 'admin-accommodations' && <AccommodationsManager />}

        {activeTab === 'admin-documents' && <DocumentGenerator />}

        {/* SUPERADMIN VIEWS */}
        {activeTab === 'superadmin-dashboard' && (
          <ExecutiveDashboard onNavigateTab={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === 'superadmin-compliance' && <ComplianceMatrix />}

        {activeTab === 'superadmin-audit' && <AuditLogViewer />}

        {activeTab === 'superadmin-users' && <SchoolSettingsManager />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Internationale Deutsche Schule Sarajevo (IDSS)</span>
            <span>·</span>
            <span>Privatna osnovna škola</span>
            <span>·</span>
            <span>Eksterna matura za učenike IX razreda</span>
            <span>·</span>
            <span>Usklađeno sa Zakonom o osnovnom odgoju i obrazovanju KS</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowArchitectureModal(true)}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              {t('app.techStack')} & DDL šema
            </button>
            <span>·</span>
            <button
              onClick={() => setShowAuthModal(true)}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Prijava / Odjava
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <StackArchitectureModal
        isOpen={showArchitectureModal}
        onClose={() => setShowArchitectureModal(false)}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        currentUser={currentUser}
        onUserChange={(user) => {
          setCurrentUser(user);
          if (user.role === 'student') setActiveTab('student-dashboard');
          else if (user.role === 'admin') setActiveTab('admin-config');
          else setActiveTab('superadmin-dashboard');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}
