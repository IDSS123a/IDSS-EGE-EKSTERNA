import React, { useState } from 'react';
import { useTranslation } from '../i18n/index.tsx';
import { Layers, Database, Server, Monitor, ShieldCheck, Check, Code, FileText } from 'lucide-react';

interface StackArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StackArchitectureModal: React.FC<StackArchitectureModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'stack' | 'schema'>('stack');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-600" />
              Arhitektura sistema i obrazloženje tehnološkog steka (Faza 1)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Skalabilna platforma za eksternu maturu usklađena sa standardima i zakonodavstvom
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-base cursor-pointer">
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('stack')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'stack' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Obrazloženje steka (Frontend, Backend, DB)
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
              activeTab === 'schema' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Relaciona šema baze podataka (PostgreSQL DDL)
          </button>
        </div>

        {activeTab === 'stack' && (
          <div className="space-y-6 text-slate-700 leading-relaxed">
            {/* Frontend */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Monitor className="w-4 h-4 text-indigo-600" />
                1. Frontend: React 19 + TypeScript + Tailwind CSS v4 + Motion
              </h3>
              <p>
                <strong>Obrazloženje i prednosti:</strong> React pruža reaktivno, deklarativno upravljanje stanjem potrebno za vremenski osjetljive ispitne simulacije (odbacivanje jittera tajmera, trenutno označavanje neodgovorenih pitanja). TypeScript eliminira greške u tipovima prilikom obrade bodova i konfiguracije bazena pitanja. Tailwind CSS omogućava strogu primjenu institucionalnog dizajna (bez generičkog "AI slopa", uz tabularne brojeve za precizno poravnanje ocjena i print-ready CSS za službena akta).
              </p>
            </div>

            {/* Backend */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" />
                2. Backend: Node.js + Express (RESTful API) + Modularni servisni sloj
              </h3>
              <p>
                <strong>Obrazloženje i prednosti:</strong> Arhitektura bazirana na Express REST API-ju osigurava visoku propusnost i nisku latenciju pri istovremenom polaganju stotina učenika. Omogućava strogu validaciju ulaznih podataka, zaštitu od XSS/SQL injection napada, centralizovano bilježenje neizmjenjivog revizijskog traga (Audit Trail) i odvojenu poslovnu logiku za izvlačenje pitanja iz bazena (Question Pool) sa nasumičnim izborom i uravnoteženim nivoima težine.
              </p>
            </div>

            {/* Database */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                3. Baza podataka: PostgreSQL sa relacijama, JSONB i indeksima
              </h3>
              <p>
                <strong>Obrazloženje i prednosti:</strong> Eksterna matura zahtijeva strogi ACID integritet transakcija (pohrana konačnih bodova, verifikacija protokola, revizijski trag). PostgreSQL relacioni model podržava hijerarhijske kategorije, strane ključeve i indekse za trenutnu pretragu po hiljadama ispitnih zadataka, dok JSONB kolone nude fleksibilnost za konfiguraciju ponuđenih opcija zadataka i pravila komisije.
              </p>
            </div>

            {/* Regulatory Compliance */}
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2">
              <h3 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                4. Usklađenost sa zakonskim propisima i regulativom
              </h3>
              <p className="text-emerald-900">
                Sistem je dizajniran s ciljem dosljedne primjene Zakona o osnovnom odgoju i obrazovanju Kantona Sarajevo i propisa za eksternu maturu IX razreda u osnovnoj školi: ugrađeni elektronski registar usklađenosti za Internationale Deutsche Schule Sarajevo (IDSS), evidencija inkluzivnih prilagodbi za učenike s teškoćama, te neizmjenjivi revizijski trag koji štiti integritet ispitnog procesa od vanjskih manipulacija.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'schema' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Datoteka: <strong className="font-mono text-slate-800">/src/db/schema.sql</strong></span>
              <span>PostgreSQL DDL / PostgreSQL 14+</span>
            </div>

            <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-[60vh] leading-relaxed">
{`-- Relacione tabele za eksternu maturu
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    canton_region VARCHAR(100) NOT NULL
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id),
    email VARCHAR(150) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'student', 'admin', 'superadmin'
    status VARCHAR(50) DEFAULT 'active',
    class_name VARCHAR(20)
);

CREATE TABLE question_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    parent_id UUID REFERENCES question_categories(id),
    name VARCHAR(150) NOT NULL,
    path TEXT[] NOT NULL
);

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    category_id UUID REFERENCES question_categories(id),
    topic VARCHAR(150) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_option_id VARCHAR(10) NOT NULL,
    points NUMERIC(4, 2) NOT NULL DEFAULT 2.00,
    difficulty VARCHAR(50) NOT NULL,
    cognitive_domain VARCHAR(50) NOT NULL
);

CREATE TABLE exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    title VARCHAR(200) NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 90,
    room_number VARCHAR(50) NOT NULL,
    max_candidates INT NOT NULL DEFAULT 30,
    pool_config JSONB,
    rules JSONB,
    commission JSONB
);

CREATE TABLE student_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id),
    subject_id UUID NOT NULL REFERENCES subjects(id),
    score_achieved NUMERIC(5, 2) NOT NULL,
    percentage NUMERIC(5, 2) NOT NULL,
    is_passed BOOLEAN NOT NULL,
    answers JSONB NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    user_email VARCHAR(150),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);`}
            </pre>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            Zatvori prikaz
          </button>
        </div>
      </div>
    </div>
  );
};
