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
