# CHANGELOG

[2026-09-27] [DOCS] Commander bootstrap: CLAUDE.md, CONSTITUTION.md, DECISION_LOG.md, .commander-version, corrections/
[2026-09-27] [DISCOVERY] Source inventory and evidence map, prototype audit, ambiguity register
[2026-09-27] [CANON] Catalogue ingestion evidence tool + outputs: Math 200, B/H/S 200 (+20 supplementary), German 200 scored items; ingestion report
[2026-09-27] [ARCHITECTURE] Target architecture, data model, roles and permissions, phased plan, Sprint 01 definition
[2026-09-27] [INFRA] Commander automation v1.6.1 installed (hooks, skills, CI project guard)
[2026-09-27] [FEATURE] Next.js 16 app scaffold with design tokens and baseline security headers
[2026-09-27] [FEATURE] First-paint splash (public/splash) with official IDSS logo, WebGL IDSS flow field, 12 rotating messages in bs/de/en
[2026-09-27] [FEATURE] Live interface language switch bs/de/en without reload
[2026-09-27] [TEST] Playwright e2e: splash first paint, dismissal, language switch, reduced motion
[2026-09-27] [CONTENT] Splash message 10 revised by the Director: "Spreman? Tvoj put upravo počinje." (de/en aligned)
[2026-09-27] [DATABASE] Migrations 001_identity, 002_canon_registry, 003_audit + local RLS test harness (npm run test:db)
[2026-09-27] [ENV] Added NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY to .env.example
[2026-09-27] [DATABASE] Migrations 001–004 applied to Supabase dezevstfmfliyasdeflj; 004 moves authorization helpers to private schema (security advisor clean)
[2026-09-27] [DOCS] README with local Windows setup (C:\DAVOR_PRIVATE\AI\EKSTERNA-MATURA-2026-2027)
[2026-09-27] [FEATURE] Username + password sign-in (/prijava), protected /app, logout, lockout, security events and audit log
[2026-09-27] [FEATURE] Superadmin bootstrap script (npm run accounts:bootstrap)
[2026-09-27] [TEST] Vitest unit tests for authentication rules; e2e for redirects, forged cookie, validation and fail-closed login
[2026-09-27] [FEATURE] Account administration /app/nalozi: create, status lifecycle with Auth ban, bundles, password reset, audit
[2026-09-27] [CONFIG] Student minimum password length set to 10 (Director, AMB-15)
[2026-09-27] [SECURITY] Nonce-based Content-Security-Policy per request (src/proxy.ts); e2e proves injected inline scripts are blocked
[2026-09-27] [DATABASE] Migration 005: RLS performance (merged policies, auth.uid() init-plan, FK indexes)
[2026-09-27] [SPRINT] Sprint 01 closed: DONE checklist, compliance score, handoff note
[2026-09-27] [RULE] P-13 no AI characters or AI phrasing in app text; UI text cleaned; npm run check:text + CI step; runtime filter src/lib/text-style.ts
[2026-09-27] [CONFIG] Splash minimum 5.8 s (+4 s, Director), fail-safe 12 s
[2026-09-27] [RULE] P-14 every device, full width on desktop; fluid layout, safe areas, viewport; e2e layout test 320 to 2560 px
[2026-09-27] [DATABASE] Migration 006_canon_lifecycle: private canon bucket, version history, dependency map, lifecycle functions (service role only); applied to Supabase
[2026-09-27] [FEATURE] Canon registry /app/kanon: direct signed upload, server-side PDF/size/SHA-256 verification, version lifecycle (activate, reject, restore, archive), history, dependency counts, signed downloads
[2026-09-27] [SECURITY] Failed write attempts audited for canon and account actions; CSP connect-src opened only for signed canon uploads
[2026-09-27] [SEED] npm run canon:seed registers and activates the three current catalogues (AMB-02)
[2026-09-27] [CONFIG] Next.js dev indicator hidden (devIndicators: false); dev-only, errors still shown
[2026-09-27] [FIX] Server error no longer hides the app behind the splash: splash ends when its module never ran, CSS fail-safe, /app error boundary and loading state
[2026-09-27] [SPRINT] Sprint 02 closed: DONE checklist, compliance score, handoff note
[2026-09-27] [CANON] TypeScript catalogue extractor (pdf.js) with parser profiles; reproduces the Sprint 00 reference for all 500 records (regression test)
[2026-09-27] [DATABASE] Migration 007_ingestion: ingestion jobs and untrusted records, append-only, dependency map; applied to Supabase
[2026-09-27] [FEATURE] Question extraction per catalogue version on /app/kanon (canon.publish): job report, review notes in bs/de/en, failed runs recorded with their reason
[2026-09-27] [FIX] Abandoned staging uploads older than a day are removed on the next upload (Sprint 02 debt)
[2026-09-27] [DISCOVERY] Nine new ministry documents reviewed (C20 to C24 + administrative); tests only from catalogue tasks (C21); enrolment weight of the matura (C20); AMB-17, AMB-18
[2026-09-27] [DOCS] docs/architecture/EXAM_SIMULATION.md: mock exams and practice sets from official catalogue tasks, anti-repetition design
[2026-09-27] [FIX] canon:seed checks local files first with a restore hint and exits cleanly on Windows
[2026-09-27] [DECISION] PDL-014 (AMB-17): mock exams only from official tasks; practice variants only with teacher approval
[2026-09-27] [CONTENT] Catalogue PDFs renamed to one pattern (Ispitni katalog za ...); same SHA-256
[2026-09-27] [SPRINT] Sprint 03 closed: live ingestion verified by database fingerprints; DONE checklist, compliance score, handoff note
[2026-09-27] [CANON] Canonical facts (subjects and exam rules) with verbatim page quotes per catalogue edition, verified by test and on the server (PDL-015)
[2026-09-27] [DATABASE] Migration 008_review_knowledge: subjects, subject areas, canonical rules and rule reviews, record reviews, trusted question versions, printed answer keys, key revisions; subject-scoped write functions (service role only); applied to Supabase
[2026-09-27] [FEATURE] Subject-teacher rights per subject on /app/nalozi (AMB-16)
[2026-09-27] [FEATURE] Review queue /app/pregled: each record beside its original page region (pdf.js), accept with confirmed task type or return with reason; answer-key revisions that never change the printed key; exam rules with quotes, confirm or dispute
[2026-09-27] [SECURITY] CSP worker-src 'self' (pdf.js worker); review source served same-origin only to reviewers of that subject, SHA-256 re-checked
[2026-09-27] [CANON] 494 catalogue records accepted as trusted (2 individually, 492 in bulk by Director order, tagged, PDL-016); 20 rules confirmed; 6 German records pending
[2026-09-27] [SPRINT] Sprint 04 closed: facts, scoped review, 494 trusted questions; DONE checklist, compliance score, handoff note
[2026-09-27] [DATABASE] Migrations 009 to 011: retrieval over trusted canon (chunks, audited retrieve_canon with active-version and subject filter, diacritic folding, ranking by matched words); applied to Supabase
[2026-09-27] [FEATURE] /app/pretraga: search of checked questions and confirmed rules with cited results and a fixed refusal; "Izgradi indeks" for the Superadmin (PDL-017)
[2026-09-27] [TEST] Local test database created as UTF-8 (was SQL_ASCII), matching Supabase
[2026-09-27] [DECISION] PDL-018: teacher grades mock exams (system pre-scores closed items), answers only after grading or after a practice answer, notifications per submitted exam plus daily summary, rewards follow the confirmed grade; AMB-19 footnote text in six trusted questions (five Math, one German)
[2026-09-27] [SPRINT] Sprint 05 closed: retrieval foundation used live; DONE checklist, compliance score, handoff note
[2026-09-27] [DESIGN] Splash palette: yellow, blue and sky prevail, red only in traces (PDL-019); measured on rendered frames
[2026-09-27] [FEATURE] Postavke: the Superadmin sets the splash colour shares in percent; measured calibration turns them into shader thresholds (PDL-020, migration 012)
[2026-09-27] [CONTENT] Product name in every app text: "IDSS - External Graduate Examination" (Director); meta titles, splash, home, preview
[2026-09-27] [FEATURE] Footer on every page (bottom left): Terms of Use, Privacy Policy, Subscription, Cookie notice, product line with ai@idss.ba; document pages wait for IDSS texts (AMB-20)
[2026-09-27] [CONTENT] Legal documents written (Terms of Use, Privacy Policy, Subscription, Cookie notice) in bs/de/en, facts confirmed by the Director (AMB-20 resolved)
[2026-09-27] [FEATURE] Moj nalog: every account changes its own password (current password verified, failed attempts count towards the lockout, audited)
[2026-09-27] [DATABASE] Migration 013_question_text_revisions applied: reviewed text revisions of trusted questions, texts only, append-only, audited (AMB-19, PDL-021)
[2026-09-27] [FEATURE] Review screen: "Tekst pitanja za učenike" with correction history and form; prepared footnote-removal proposals for MAT-5.3.5, 5.4.20, 5.9.13, 5.10.6, 5.10.20 (confirmed by a reviewer, never written automatically)
[2026-09-27] [FIX] Review queue: shows all records when none is waiting, finds a record by its code (e.g. 5.3.5), lists the open text-correction proposals with direct links (Director could not reach the AMB-19 questions)
[2026-09-27] [FIX] Link buttons with the secondary style centre their label; "Moj nalog" on the home page styled like the other buttons
[2026-09-27] [CONTENT] Legal documents v2.0 (bs/de/en): full Terms of Use, Privacy Policy (GDPR and BiH Law 12/25, data protection officer gdpr@idss.ba, rights, processors, transfers, retention, security, breaches), Subscription and Cookie notice
[2026-09-27] [FEATURE] Splash returns to the FLOW algorithm of the approved "Untitled blend" reference (ported exactly: drifting colour points, weighted inverse-distance blend, warp and swirl); the Director's shares become colour weights fitted by measuring the field on the server, within half a point of each share (PDL-022); threshold calibration removed
[2026-09-27] [DATABASE] Migration 014: text revisions store \n line breaks and refuse a revision that changes nothing (UNCHANGED); applied live
[2026-09-27] [FIX] Review screen: the correction form is folded behind "Ispravi tekst" unless a prepared proposal exists; stored \r\n line breaks are read as \n
[2026-09-27] [CONTENT] Legal documents v2.1: IDSS identity (Buka 13, ID number, MBSU), court in Sarajevo confirmed, security records kept in accordance with the law
[2026-09-27] [CANON] AMB-19 resolved: the Director confirmed the five footnote corrections (verified in the database)
[2026-09-27] [DATABASE] Migration 015_semantic_retrieval applied: pgvector, chunk embeddings bound to their text, semantic retrieval fused with full-text, audited with method (PDL-023)
[2026-09-27] [FEATURE] Search by meaning with Gemini (gemini-embedding-2, 768 dimensions): "Izgradi indeks po značenju" on /app/pretraga, search falls back to words without a key, index or on a Gemini failure; only catalogue and query text go to Google
[2026-09-27] [ENV] Added GEMINI_API_KEY (server only; GOOGLE_API_KEY accepted) to .env.example
[2026-09-27] [FEATURE] Gemini key rotation: GEMINI_API_KEY_1 to _10 (Director), round robin, next key on quota or refusal (PDL-023)
[2026-09-27] [FIX] Semantic index build: retries Gemini server errors on the next key, isolates and skips a failing passage instead of stopping, shows Gemini's answer and the skipped count (first live build stopped at 100 of 514)
[2026-09-27] [FIX] Search by meaning: relevance measured per query (z value, migration 016) instead of the guessed 0.6 floor that let unrelated passages through ("Ministar"); top similarity recorded per search for tuning
[2026-09-27] [DATABASE] Migrations 017_practice and 018_practice_item_options applied: practice answers per person, questions without keys, solution after the answer, auto-check by the effective key (PDL-024)
[2026-09-27] [FEATURE] Game Hub for students: practice streak, daily mission (5 tasks), the three subjects with mastery; subject pages with areas; practice screen with choice, true/false and open answers, feedback and catalogue solution; listening transcript labelled (AMB-04)
[2026-09-27] [FEATURE] Search: query translated into bs/de/en, grounded answer from cited sources with Gemini (PDL-025)
[2026-09-27] [SPRINT] Sprint 06 closed: DONE checklist, compliance score, handoff note (search carried over)
[2026-10-03] [DATABASE] Migration 019: mock exams, blueprints with reviewer confirmation, pre-scoring, teacher grading, release, notifications
[2026-10-03] [CANON] P-15 canon fidelity: catalogue crops for every question, printed key only, errata notices, teacher verdicts on practice answers (migrations 020, 021); set approval and grading by pairs (022, 023, pending)
[2026-10-03] [FEATURE] Review screen (P-15): catalogue errata form (record, withdraw), follow-ups (request, mark as checked), open notices per subject on the queue; text and key revision forms removed, their rows kept as history
[2026-10-03] [FEATURE] Student mock exam screens /app/ispit: request a set, waiting for teacher approval, start, countdown on the server clock, autosave, submission, result after grading with printed key and errata; Game Hub link
[2026-10-03] [FEATURE] Teacher mock exam area /app/ocjenjivanje: blueprints per subject (load from config by SHA-256, confirm or reject by the subject reviewer), sets awaiting approval (approve, discard with reason and optional new set), grading with printed key, proposals, pairs for matching, notes and result confirmation
[2026-10-03] [GOVERNANCE] Commander upgraded to v1.6.2 (PDL-028): stamps only, automation unchanged
[2026-10-03] [FEATURE] In-app notifications (submitted mock exams for teachers, released results for students) on the Game Hub and in the grading area
[2026-10-03] [SPRINT] Sprint 07 closed: DONE checklist, compliance score, handoff note
[2026-10-03] [FEATURE] Teacher review of open practice answers (/app/ocjenjivanje/vjezba); migration 024 written (set request notifications, pending Director run)
[2026-10-03] [SECURITY] Leaked passwords refused in the application (Pwned Passwords range API, PDL-030); migration 024 live
[2026-10-03] [FEATURE] XP and badges on the Game Hub (migration 025, PDL-029), derived read-only from the student's events
[2026-10-03] [DOCS] User guide source per participant (docs/user-guide, PDL-031); "IDSS bodovi" replaces "XP" in app texts
[2026-10-03] [SPRINT] Sprint 08 closed: DONE checklist, compliance score, handoff note
[2026-10-03] [FEATURE] Student monitoring for the pedagogue and the psychologist (/app/pracenje): overview with user-set filters, student profile, support notes (D1 to D3), group analysis, IDSS readiness (PDL-032), print and CSV export
[2026-10-03] [FEATURE] Subject teacher view of student progress (own subject only) and the daily summary /app/pracenje/dan (migration 027, PDL-033)
[2026-10-03] [FEATURE] Academic teacher notes per student and subject on the student profile (migration 028, PDL-034); assignments design proposal (ASSIGNMENTS.md, decisions Z1 to Z6)
[2026-10-03] [FEATURE] Uniform IDSS print and export format for every analysis and result (PDL-036): letterhead, page footer, IDSS CSV with heading rows; CSV for the daily summary and the group analysis
[2026-10-03] [DOCS] Assignments approved (PDL-035, Z1 to Z6); special gifts design proposal (SPECIAL_GIFTS.md, G1 to G6)
[2026-10-03] [FEATURE] Teacher assignments (migration 029, PDL-035): /app/zadaci (group or chosen students, picked keys or area draw, required due date, withdraw, IDSS print and CSV), "Zadaci nastavnika" on the Game Hub, assignment practice, assignments on the student profile; migration 030 (in-app notification) handed to the Director
[2026-10-03] [FEATURE] Web Push notices (migration 031, PDL-037): free browser push, per-device switch, service worker; VAPID keys in .env.local
[2026-10-03] [FEATURE] Special gifts and the IDSS Vitrina (migration 032, PDL-039): six procedural 3D gifts (three.js, PBR, bloom), unboxing animation, teacher form on the student profile, "Moja vitrina" on the Game Hub, Web Push notice
[2026-10-04] [SPRINT] Sprint 09 closed: DONE checklist, compliance score, handoff note
[2026-10-04] [DATABASE] Migration 033 (PDL-040): Director Command Center functions, settings with history (mission goal, IDSS points and badges, minimum group 3)
[2026-10-04] [FEATURE] Direktorski pregled /app/direktor (PDL-040): Pregled, Predmeti, Nastavnici, Sadržaj, Sistem, Dnevnik; small-group protection; IDSS print; CSV for teachers and the audit log (audited)
[2026-10-04] [FEATURE] Postavke: daily mission goal, IDSS points and badges, minimum group, each with history
[2026-10-04] [DOCS] README: VAPID keys and migration 030 steps for the Director; Sprint 11 draft plan (L1 to L4)
[2026-10-04] [UX] In-app confirmation dialog in the IDSS look replaces every browser confirm box (ten places)
[2026-10-04] [FIX] Migration 034: the Sistem tab of the Director overview works as service_role (migration list via private.recent_migrations)
[2026-10-04] [SPRINT] Sprint 10 closed: DONE checklist, compliance score, handoff note
[2026-10-04] [DOCS] PDL-041: Vercel (school account), matura.idss.ba, WCAG 2.2 AA, target launch 2026-10-06; Sprint 11 started
[2026-10-04] [DATABASE] Migration 030 run by the Director: in-app notices for assignments and gifts are on
[2026-10-04] [DOCS] PDL-041 L2 refined: Vercel team idsssarajevo on the Vercel address; README deployment steps
[2026-10-04] [FIX] Sistem tab: malformed VAPID values are reported (which field) instead of crashing the page
[2026-10-04] [A11Y] WCAG 2.2 AA: axe checks in e2e for public pages; scroll tables reachable by keyboard; unearned badge contrast
[2026-10-04] [DEPENDENCY] @axe-core/playwright (devDependency): run npm install after git pull
[2026-10-04] [SECURITY] Adversarial pass: live probes as anon and as a student all refused; DB section 28 guards RLS, write policies, function grants and search_path
