-- ============================================================================
-- SISTEM ZA EKSTERNU MATURU - RELACIONA BAZA PODATAKA (PostgreSQL)
-- Internationale Deutsche Schule Sarajevo (IDSS) - Privatna osnovna škola
-- Schema verzija: 1.1.0
-- Usklađeno sa Zakonom o osnovnom odgoju i obrazovanju KS i Pravilnikom o eksternoj maturi IX razreda
-- ============================================================================

-- Ekstenzije za UUID i brzu pretragu teksta
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tabela institucija i škola
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    ministry_authority VARCHAR(255) NOT NULL,
    canton_region VARCHAR(100) NOT NULL,
    address TEXT,
    contact_email VARCHAR(120),
    contact_phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Korisnici i uloge (RBAC)
CREATE TYPE user_role AS ENUM ('student', 'admin', 'superadmin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'pending_approval');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE RESTRICT,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    status user_status NOT NULL DEFAULT 'active',
    student_index_number VARCHAR(50), -- Broj u matičnoj knjizi učenika / šifra
    class_name VARCHAR(20),            -- npr. 'IV-1', 'IV-2', 'IX-a'
    phone_number VARCHAR(50),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_class ON users(class_name);

-- 3. Nastavni predmeti na eksternoj maturi
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL, -- npr. 'BHS-01', 'MAT-01', 'ENG-01'
    name VARCHAR(100) NOT NULL,
    description TEXT,
    duration_minutes INT NOT NULL DEFAULT 90,
    passing_threshold_percent INT NOT NULL DEFAULT 50,
    is_mandatory BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Baza ispitnih pitanja (Question Bank)
CREATE TYPE question_difficulty AS ENUM ('basic', 'intermediate', 'advanced');
CREATE TYPE cognitive_domain AS ENUM ('knowledge', 'comprehension', 'application', 'analysis');

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    topic VARCHAR(150) NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL, -- Polje sa opcijama odgovora [{ id: "A", text: "..." }, ...]
    correct_option_id VARCHAR(10) NOT NULL,
    points NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    difficulty question_difficulty NOT NULL DEFAULT 'intermediate',
    cognitive_domain cognitive_domain NOT NULL DEFAULT 'comprehension',
    explanation TEXT,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_questions_subject ON questions(subject_id);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_domain ON questions(cognitive_domain);

-- 5. Ispitni rokovi i sesije (Exam Sessions & Commissions)
CREATE TYPE exam_session_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

CREATE TABLE exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 90,
    room_number VARCHAR(50) NOT NULL,
    max_candidates INT NOT NULL DEFAULT 30,
    status exam_session_status NOT NULL DEFAULT 'scheduled',
    commission_president_id UUID REFERENCES users(id) ON DELETE SET NULL,
    supervisor_1_id UUID REFERENCES users(id) ON DELETE SET NULL,
    supervisor_2_id UUID REFERENCES users(id) ON DELETE SET NULL,
    evaluator_id UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Prijave i raspored učenika po sesijama
CREATE TABLE exam_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_session_id UUID NOT NULL REFERENCES exam_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    seat_number INT,
    attended BOOLEAN DEFAULT false,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(exam_session_id, student_id)
);

-- 7. Pokušaji i rezultati ispita (Student Attempts & Simulations)
CREATE TABLE student_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exam_session_id UUID REFERENCES exam_sessions(id) ON DELETE SET NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    is_simulation BOOLEAN NOT NULL DEFAULT true,
    score_achieved NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    max_score NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    is_passed BOOLEAN NOT NULL DEFAULT false,
    duration_seconds INT NOT NULL DEFAULT 0,
    answers JSONB NOT NULL, -- { "question_id": "selected_option" }
    review_notes TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attempts_student ON student_attempts(student_id);
CREATE INDEX idx_attempts_subject ON student_attempts(subject_id);

-- 8. Pedagoško-psihološke prilagodbe (Inkluzija i posebne potrebe)
CREATE TYPE accommodation_type AS ENUM ('extra_time_25', 'extra_time_50', 'large_font', 'personal_assistant', 'adapted_room', 'special_devices');

CREATE TABLE student_accommodations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type accommodation_type NOT NULL,
    legal_basis_reference VARCHAR(255) NOT NULL, -- Član pravilnika ili stručno mišljenje komisije
    description TEXT NOT NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Zakonska usklađenost i propisi (Regulatory Compliance Matrix)
CREATE TYPE compliance_status AS ENUM ('compliant', 'in_progress', 'action_required');

CREATE TABLE compliance_regulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    act_title VARCHAR(255) NOT NULL,
    article_reference VARCHAR(100) NOT NULL,
    requirement_summary TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'organizacija', 'sigurnost_testova', 'komisije', 'rokovi', 'ocjenjivanje'
    status compliance_status NOT NULL DEFAULT 'compliant',
    responsible_person VARCHAR(150),
    last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- 10. Generisani službeni dokumenti (Documents Archive)
CREATE TYPE document_type AS ENUM ('minutes', 'candidate_list', 'commission_resolution', 'results_summary', 'certificate');

CREATE TABLE generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    protocol_number VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    academic_year VARCHAR(20) NOT NULL,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. Revizijski trag (Audit Trail) - Integritet eksterne mature
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    user_email VARCHAR(150),
    user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL, -- 'QUESTION_CREATED', 'EXAM_SCHEDULED', 'GRADE_RECORDED', 'COMMISSION_APPOINTED', 'SETTINGS_UPDATED'
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    details JSONB,
    ip_address VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);
