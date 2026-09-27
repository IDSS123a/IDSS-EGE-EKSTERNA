import React, { createContext, useContext, useState, useEffect } from 'react';

export type SupportedLanguage = 'bs' | 'de' | 'en';

export interface Translations {
  [key: string]: string;
}

export const translations: Record<SupportedLanguage, Translations> = {
  bs: {
    // Top Bar & Brand
    'app.title': 'Internationale Deutsche Schule Sarajevo',
    'app.subtitle': 'Privatna osnovna škola · Eksterna matura za učenike IX razreda',
    'app.ministry': 'Ministarstvo za odgoj i obrazovanje KS - PPZ',
    'app.academicYear': 'Šk. god. 2025/2026',
    'app.techStack': 'Tehnološki stek & Arhitektura',
    'app.role': 'Uloga',
    'app.role.student': 'Učenik IX razreda',
    'app.role.admin': 'Nastavnik / Pedagog',
    'app.role.superadmin': 'Direktor škole',

    // Navigation
    'nav.dashboard': 'Matična ploča',
    'nav.simulator': 'Simulator ispita',
    'nav.practice': 'Vježbaonica zadataka',
    'nav.badges': 'Značke & Postignuća',
    'nav.analytics': 'Analitika uspjeha',
    'nav.rules': 'Vodič za kandidate (IX razred)',
    'nav.questions': 'Baza pitanja & Oznake',
    'nav.examConfig': 'Konfiguracija & Raspored ispita',
    'nav.monitoring': 'Praćenje učenika IX razreda',
    'nav.accommodations': 'Pedagoške prilagodbe',
    'nav.documents': 'Službena akta',
    'nav.directorDashboard': 'Nadzorna ploča direktora',
    'nav.compliance': 'Zakonska usklađenost',
    'nav.audit': 'Revizijski trag',
    'nav.usersAndSettings': 'Korisnici & Postavke',

    // Language Selector
    'lang.select': 'Jezik',
    'lang.bs': 'Bosanski (B/H/S)',
    'lang.de': 'Deutsch',
    'lang.en': 'English',

    // Student Dashboard
    'student.welcome': 'Portal eksterne mature za učenike devetog (IX) razreda',
    'student.class': 'Odjeljenje IX razreda',
    'student.indexNumber': 'Matična šifra',
    'student.totalSimulations': 'Ukupno simulacija',
    'student.avgScore': 'Prosječan rezultat',
    'student.passRate': 'Prolaznost',
    'student.statusVerified': 'Prijava verificirana',
    'student.officialSchedule': 'Zvanični raspored polaganja eksterne mature',
    'student.startSimulation': 'Pokreni simulaciju ispita',
    'student.openPractice': 'Otvori vježbaonicu',
    'student.subjectReadiness': 'Spremnost po predmetima',

    // Admin Exam Configurator
    'admin.config.title': 'Planiranje i konfiguracija ispita eksterne mature',
    'admin.config.subtitle': 'Definisanje termina, trajanja, pravila ispita i kriterija za izvlačenje pitanja iz ispitne baze',
    'admin.config.newExam': '+ Konfiguriši novi ispitni rok',
    'admin.config.examTitle': 'Naziv ispita',
    'admin.config.description': 'Opis / Svrha ispita',
    'admin.config.subject': 'Ispitni predmet',
    'admin.config.startDateTime': 'Početak (Datum i vrijeme)',
    'admin.config.endDateTime': 'Završetak (Datum i vrijeme)',
    'admin.config.duration': 'Trajanje (minuti)',
    'admin.config.maxCandidates': 'Maksimalan broj kandidata',
    'admin.config.roomNumber': 'Ispitna prostorija / Sala',
    'admin.config.passingThreshold': 'Prag prolaznosti (%)',
    'admin.config.poolCriteria': 'Kriteriji za bazen pitanja (Question Pool)',
    'admin.config.selectedCategories': 'Odabrane kategorije',
    'admin.config.selectedTags': 'Obavezne oznake (Tags)',
    'admin.config.shuffleQuestions': 'Nasumični redoslijed pitanja',
    'admin.config.calculatorAllowed': 'Dozvoljena upotreba kalkulatora',
    'admin.config.formulaSheet': 'Dozvoljene formule i tablice',
    'admin.config.commission': 'Ispitna komisija',
    'admin.config.president': 'Predsjednik komisije',
    'admin.config.supervisors': 'Dežurni nastavnici',
    'admin.config.evaluator': 'Ispitivač / Ocjenjivač',
    'admin.config.saveConfig': 'Sačuvaj i objavi konfiguraciju',
    'admin.config.cancel': 'Odustani',
    'admin.config.status': 'Status',
    'admin.config.actions': 'Akcije',

    // Question Bank & Categories
    'questions.title': 'Baza ispitnih zadataka i hijerarhijska taksonomija',
    'questions.subtitle': 'Upravljanje zadacima, hijerarhijskim kategorijama, kognitivnim nivoima i fleksibilnim oznakama',
    'questions.newQuestion': '+ Novo ispitno pitanje',
    'questions.newCategory': '+ Nova kategorija',
    'questions.categoryTree': 'Hijerarhijske kategorije',
    'questions.allCategories': 'Sve kategorije',
    'questions.tags': 'Fleksibilne oznake (Tags)',
    'questions.allTags': 'Sve oznake',
    'questions.difficulty': 'Težina',
    'questions.cognitiveDomain': 'Kognitivni domen',
    'questions.search': 'Pretraži pitanja...',
    'questions.topic': 'Oblast / Tema',
    'questions.points': 'Bodovi',
    'questions.explanation': 'Metodičko objašnjenje',
    'questions.solution': 'Rješenje',
    'questions.edit': 'Uredi',
    'questions.delete': 'Obriši',
    'questions.options': 'Ponuđeni odgovori',
    'questions.correctAnswer': 'Tačan odgovor',

    // Difficulties
    'diff.basic': 'Osnovni nivo',
    'diff.intermediate': 'Srednji nivo',
    'diff.advanced': 'Napredni nivo',

    // Domains
    'domain.knowledge': 'Poznavanje činjenica',
    'domain.comprehension': 'Razumijevanje',
    'domain.application': 'Primjena znanja',
    'domain.analysis': 'Analiza i sinteza',

    // Accommodations & Monitoring
    'monitoring.title': 'Praćenje uspjeha učenika i odjeljenja',
    'monitoring.accommodationsTitle': 'Pedagoško-psihološke prilagodbe (Inkluzija)',
    'monitoring.newAccommodation': '+ Evidentiraj novu prilagodbu',
    'monitoring.student': 'Učenik',
    'monitoring.class': 'Odjeljenje',
    'monitoring.type': 'Vrsta prilagodbe',
    'monitoring.legalBasis': 'Pravni osnov (član Pravilnika)',
    'monitoring.approvedBy': 'Odobrio (stručna služba)',

    // Documents
    'docs.title': 'Generator službene ispitne dokumentacije',
    'docs.subtitle': 'Automatsko generisanje zapisnika, spiskova, rješenja o komisijama i certifikata sa protokolnim brojevima',
    'docs.generate': 'Generiši novi akt',
    'docs.print': 'Štampaj službeni dokument',
    'docs.protocol': 'Broj protokola',
    'docs.date': 'Datum',

    // Superadmin & Compliance
    'superadmin.dashboard': 'Rukovodna kontrolna tabla direktora',
    'superadmin.kpis': 'Ključni indikatori procesa eksterne mature',
    'superadmin.compliance': 'Matrica zakonske usklađenosti i propisi',
    'superadmin.audit': 'Revizijski trag (Audit Log)',
    'superadmin.settings': 'Matične postavke škole i upravljanje ulogama',
    'superadmin.complianceStatus': 'Status usklađenosti',
    'superadmin.verify': 'Verifikuj',

    // Actions & Misc
    'btn.save': 'Sačuvaj',
    'btn.cancel': 'Odustani',
    'btn.close': 'Zatvori',
    'btn.filter': 'Filtriraj',
    'btn.reset': 'Poništi',
    'btn.submit': 'Pošalji',
    'common.loading': 'Učitavanje...',
    'common.noData': 'Nema dostupnih podataka.',
  },

  de: {
    // Top Bar & Brand
    'app.title': 'Internationale Deutsche Schule Sarajevo',
    'app.subtitle': 'Private Grundschule · Abschlussprüfung der 9. Klasse (IDSS)',
    'app.ministry': 'Ministerium für Bildung und Erziehung KS - PPZ',
    'app.academicYear': 'Schuljahr 2025/2026',
    'app.techStack': 'Technologiestack & Architektur',
    'app.role': 'Rolle',
    'app.role.student': 'Schüler/in (9. Klasse)',
    'app.role.admin': 'Lehrkraft / Pädagoge',
    'app.role.superadmin': 'Schulleitung',

    // Navigation
    'nav.dashboard': 'Übersicht',
    'nav.simulator': 'Prüfungssimulator',
    'nav.practice': 'Übungsbereich',
    'nav.badges': 'Abzeichen & Erfolge',
    'nav.analytics': 'Erfolgsanalyse',
    'nav.rules': 'Prüfungsordnung (9. Klasse)',
    'nav.questions': 'Fragenkatalog & Tags',
    'nav.examConfig': 'Prüfungskonfiguration & Termine',
    'nav.monitoring': 'Schülerbeobachtung (9. Klasse)',
    'nav.accommodations': 'Pädagogischer Nachteilsausgleich',
    'nav.documents': 'Amtliche Dokumente',
    'nav.directorDashboard': 'Schulleitungs-Cockpit',
    'nav.compliance': 'Rechtskonformität',
    'nav.audit': 'Audit-Protokoll',
    'nav.usersAndSettings': 'Benutzer & Einstellungen',

    // Language Selector
    'lang.select': 'Sprache',
    'lang.bs': 'Bosnisch (B/H/S)',
    'lang.de': 'Deutsch',
    'lang.en': 'Englisch',

    // Student Dashboard
    'student.welcome': 'Portal für die Abschlussprüfung der 9. Klasse (IDSS)',
    'student.class': 'Klasse (9. Klasse)',
    'student.indexNumber': 'Matrikelnummer',
    'student.totalSimulations': 'Gesamte Simulationen',
    'student.avgScore': 'Durchschnittswert',
    'student.passRate': 'Bestehensquote',
    'student.statusVerified': 'Anmeldung verifiziert',
    'student.officialSchedule': 'Offizieller Prüfungszeitplan',
    'student.startSimulation': 'Prüfungssimulation starten',
    'student.openPractice': 'Fragenkatalog öffnen',
    'student.subjectReadiness': 'Fachspezifische Prüfungsreife',

    // Admin Exam Configurator
    'admin.config.title': 'Planung und Konfiguration der Abiturprüfungen',
    'admin.config.subtitle': 'Festlegung von Terminen, Zeitdauern, Prüfungsregeln und Fragekriterien für den Fragenpool',
    'admin.config.newExam': '+ Neuen Prüfungstermin konfigurieren',
    'admin.config.examTitle': 'Prüfungsbezeichnung',
    'admin.config.description': 'Beschreibung / Prüfungszweck',
    'admin.config.subject': 'Prüfungsfach',
    'admin.config.startDateTime': 'Beginn (Datum und Uhrzeit)',
    'admin.config.endDateTime': 'Ende (Datum und Uhrzeit)',
    'admin.config.duration': 'Dauer (Minuten)',
    'admin.config.maxCandidates': 'Max. Prüflinge',
    'admin.config.roomNumber': 'Prüfungsraum / Aula',
    'admin.config.passingThreshold': 'Bestehensgrenze (%)',
    'admin.config.poolCriteria': 'Kriterien für Fragenpool (Question Pool)',
    'admin.config.selectedCategories': 'Ausgewählte Kategorien',
    'admin.config.selectedTags': 'Erforderliche Tags',
    'admin.config.shuffleQuestions': 'Zufällige Fragenreihenfolge',
    'admin.config.calculatorAllowed': 'Taschenrechner gestattet',
    'admin.config.formulaSheet': 'Formelsammlung erlaubt',
    'admin.config.commission': 'Prüfungskommission',
    'admin.config.president': 'Kommissionsvorsitz',
    'admin.config.supervisors': 'Aufsichtführende Lehrkräfte',
    'admin.config.evaluator': 'Erstprüfer / Bewerter',
    'admin.config.saveConfig': 'Konfiguration speichern',
    'admin.config.cancel': 'Abbrechen',
    'admin.config.status': 'Status',
    'admin.config.actions': 'Aktionen',

    // Question Bank & Categories
    'questions.title': 'Aufgabenpool und hierarchische Taxonomie',
    'questions.subtitle': 'Verwaltung von Prüfungsfragen, Baumkategorien, kognitiven Niveaus und flexiblen Schlagwörtern',
    'questions.newQuestion': '+ Neue Prüfungsaufgabe',
    'questions.newCategory': '+ Neue Kategorie',
    'questions.categoryTree': 'Hierarchische Kategorien',
    'questions.allCategories': 'Alle Kategorien',
    'questions.tags': 'Schlagwörter (Tags)',
    'questions.allTags': 'Alle Tags',
    'questions.difficulty': 'Schwierigkeitsgrad',
    'questions.cognitiveDomain': 'Kognitive Domäne',
    'questions.search': 'Aufgaben durchsuchen...',
    'questions.topic': 'Themenbereich',
    'questions.points': 'Punkte',
    'questions.explanation': 'Fachdidaktische Erklärung',
    'questions.solution': 'Musterlösung',
    'questions.edit': 'Bearbeiten',
    'questions.delete': 'Löschen',
    'questions.options': 'Antwortoptionen',
    'questions.correctAnswer': 'Korrekte Antwort',

    // Difficulties
    'diff.basic': 'Grundlegendes Niveau',
    'diff.intermediate': 'Mittleres Niveau',
    'diff.advanced': 'Fortgeschrittenes Niveau',

    // Domains
    'domain.knowledge': 'Faktenwissen',
    'domain.comprehension': 'Verständnis',
    'domain.application': 'Wissensanwendung',
    'domain.analysis': 'Analyse und Synthese',

    // Accommodations & Monitoring
    'monitoring.title': 'Monitoring von Schülern und Klassen',
    'monitoring.accommodationsTitle': 'Pädagogischer Nachteilsausgleich (Inklusion)',
    'monitoring.newAccommodation': '+ Nachteilsausgleich erfassen',
    'monitoring.student': 'Schüler/in',
    'monitoring.class': 'Klasse',
    'monitoring.type': 'Art der Anpassung',
    'monitoring.legalBasis': 'Rechtsgrundlage (§ Verordnung)',
    'monitoring.approvedBy': 'Genehmigt durch (Fachdienst)',

    // Documents
    'docs.title': 'Generator für amtliche Prüfungsdokumente',
    'docs.subtitle': 'Automatisierte Erstellung von Prüfungsprotokollen, Raumlisten, Kommissionsbeschlüssen und Zertifikaten',
    'docs.generate': 'Dokument erstellen',
    'docs.print': 'Amtliches Dokument drucken',
    'docs.protocol': 'Protokollnummer',
    'docs.date': 'Datum',

    // Superadmin & Compliance
    'superadmin.dashboard': 'Schulleitungs-Dashboard',
    'superadmin.kpis': 'Prüfungsprozess-Kennzahlen (KPI)',
    'superadmin.compliance': 'Rechtskonformitäts-Matrix und Verordnungen',
    'superadmin.audit': 'Revisionssicheres Audit-Log',
    'superadmin.settings': 'Schulstammdaten und Rollenverwaltung',
    'superadmin.complianceStatus': 'Konformitätsstatus',
    'superadmin.verify': 'Verifizieren',

    // Actions & Misc
    'btn.save': 'Speichern',
    'btn.cancel': 'Abbrechen',
    'btn.close': 'Schließen',
    'btn.filter': 'Filtern',
    'btn.reset': 'Zurücksetzen',
    'btn.submit': 'Absenden',
    'common.loading': 'Wird geladen...',
    'common.noData': 'Keine Daten vorhanden.',
  },

  en: {
    // Top Bar & Brand
    'app.title': 'Internationale Deutsche Schule Sarajevo',
    'app.subtitle': 'Private Elementary School · Grade 9 External Maturity Exam (IDSS)',
    'app.ministry': 'Ministry of Education and Upbringing KS - PPZ',
    'app.academicYear': 'Acad. Year 2025/2026',
    'app.techStack': 'Tech Stack & Architecture',
    'app.role': 'Role',
    'app.role.student': 'Grade 9 Student',
    'app.role.admin': 'Teacher / Pedagogue',
    'app.role.superadmin': 'School Director',

    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.simulator': 'Exam Simulator',
    'nav.practice': 'Practice Bank',
    'nav.badges': 'Badges & Achievements',
    'nav.analytics': 'Performance Analytics',
    'nav.rules': 'Candidate Guide (Grade 9)',
    'nav.questions': 'Questions & Tags',
    'nav.examConfig': 'Exam Scheduler & Config',
    'nav.monitoring': 'Grade 9 Monitoring',
    'nav.accommodations': 'Special Accommodations',
    'nav.documents': 'Official Documents',
    'nav.directorDashboard': 'Executive Dashboard',
    'nav.compliance': 'Regulatory Compliance',
    'nav.audit': 'Audit Trail',
    'nav.usersAndSettings': 'Users & Settings',

    // Language Selector
    'lang.select': 'Language',
    'lang.bs': 'Bosnian (B/H/S)',
    'lang.de': 'German (Deutsch)',
    'lang.en': 'English',

    // Student Dashboard
    'student.welcome': 'Grade 9 External Maturity Exam Portal (IDSS)',
    'student.class': 'Class (Grade 9)',
    'student.indexNumber': 'Student ID',
    'student.totalSimulations': 'Total Simulations',
    'student.avgScore': 'Average Score',
    'student.passRate': 'Pass Rate',
    'student.statusVerified': 'Registration Verified',
    'student.officialSchedule': 'Official External Exam Timetable',
    'student.startSimulation': 'Launch Exam Simulation',
    'student.openPractice': 'Open Practice Bank',
    'student.subjectReadiness': 'Subject Readiness',

    // Admin Exam Configurator
    'admin.config.title': 'External Exam Scheduling & Configuration Module',
    'admin.config.subtitle': 'Configure exam dates, duration, draw criteria from the question pool, and specific parameters',
    'admin.config.newExam': '+ Configure New Exam Instance',
    'admin.config.examTitle': 'Exam Title',
    'admin.config.description': 'Description / Purpose',
    'admin.config.subject': 'Subject',
    'admin.config.startDateTime': 'Start (Date & Time)',
    'admin.config.endDateTime': 'End (Date & Time)',
    'admin.config.duration': 'Duration (Minutes)',
    'admin.config.maxCandidates': 'Max Candidates',
    'admin.config.roomNumber': 'Examination Hall / Room',
    'admin.config.passingThreshold': 'Passing Threshold (%)',
    'admin.config.poolCriteria': 'Question Pool Drawing Criteria',
    'admin.config.selectedCategories': 'Selected Categories',
    'admin.config.selectedTags': 'Required Tags',
    'admin.config.shuffleQuestions': 'Shuffle Questions',
    'admin.config.calculatorAllowed': 'Calculator Allowed',
    'admin.config.formulaSheet': 'Formula Sheet Allowed',
    'admin.config.commission': 'Exam Commission',
    'admin.config.president': 'Commission President',
    'admin.config.supervisors': 'Invigilating Teachers',
    'admin.config.evaluator': 'Evaluator / Grader',
    'admin.config.saveConfig': 'Save & Publish Exam Instance',
    'admin.config.cancel': 'Cancel',
    'admin.config.status': 'Status',
    'admin.config.actions': 'Actions',

    // Question Bank & Categories
    'questions.title': 'Question Bank & Hierarchical Taxonomy System',
    'questions.subtitle': 'Manage standardized questions, hierarchical category trees, cognitive domains, and flexible tags',
    'questions.newQuestion': '+ New Exam Question',
    'questions.newCategory': '+ New Category',
    'questions.categoryTree': 'Hierarchical Categories',
    'questions.allCategories': 'All Categories',
    'questions.tags': 'Flexible Tags',
    'questions.allTags': 'All Tags',
    'questions.difficulty': 'Difficulty',
    'questions.cognitiveDomain': 'Cognitive Domain',
    'questions.search': 'Search questions...',
    'questions.topic': 'Topic / Domain',
    'questions.points': 'Points',
    'questions.explanation': 'Pedagogical Explanation',
    'questions.solution': 'Official Solution',
    'questions.edit': 'Edit',
    'questions.delete': 'Delete',
    'questions.options': 'Answer Options',
    'questions.correctAnswer': 'Correct Answer',

    // Difficulties
    'diff.basic': 'Basic Level',
    'diff.intermediate': 'Intermediate Level',
    'diff.advanced': 'Advanced Level',

    // Domains
    'domain.knowledge': 'Factual Knowledge',
    'domain.comprehension': 'Comprehension',
    'domain.application': 'Application',
    'domain.analysis': 'Analysis & Synthesis',

    // Accommodations & Monitoring
    'monitoring.title': 'Student & Class Performance Monitoring',
    'monitoring.accommodationsTitle': 'Psychological & Pedagogical Accommodations (Inclusion)',
    'monitoring.newAccommodation': '+ Record Special Accommodation',
    'monitoring.student': 'Student',
    'monitoring.class': 'Class',
    'monitoring.type': 'Accommodation Type',
    'monitoring.legalBasis': 'Legal Basis (Regulation Article)',
    'monitoring.approvedBy': 'Approved By (Specialist Service)',

    // Documents
    'docs.title': 'Official Exam Document Generator',
    'docs.subtitle': 'Automated generation of exam protocols, room seating lists, commission resolutions, and certificates with protocol numbers',
    'docs.generate': 'Generate Official Act',
    'docs.print': 'Print Official Document',
    'docs.protocol': 'Protocol Number',
    'docs.date': 'Date',

    // Superadmin & Compliance
    'superadmin.dashboard': 'Director Executive Dashboard',
    'superadmin.kpis': 'Maturity Exam Process Key Performance Indicators',
    'superadmin.compliance': 'Regulatory Compliance Matrix & Legal Acts',
    'superadmin.audit': 'Immutable Audit Trail',
    'superadmin.settings': 'School Profile & Role Management',
    'superadmin.complianceStatus': 'Compliance Status',
    'superadmin.verify': 'Verify',

    // Actions & Misc
    'btn.save': 'Save',
    'btn.cancel': 'Cancel',
    'btn.close': 'Close',
    'btn.filter': 'Filter',
    'btn.reset': 'Reset',
    'btn.submit': 'Submit',
    'common.loading': 'Loading...',
    'common.noData': 'No data available.',
  },
};

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string, defaultText?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'bs',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const saved = localStorage.getItem('eksterna_matura_lang') as SupportedLanguage;
    return saved && (saved === 'bs' || saved === 'de' || saved === 'en') ? saved : 'bs';
  });

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    localStorage.setItem('eksterna_matura_lang', lang);
  };

  const t = (key: string, defaultText?: string): string => {
    const langDict = translations[language] || translations.bs;
    if (langDict[key]) return langDict[key];
    // Fallback to Bosnian if translation missing in German/English
    if (translations.bs[key]) return translations.bs[key];
    return defaultText || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
