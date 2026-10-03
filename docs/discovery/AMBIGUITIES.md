# Known Ambiguities and Decisions Requiring Human Verification

Status: open register · Started: 2026-09-27 (Sprint 00)
Rule (INSTRUCTION §22, M-4/M-10): nothing below is guessed in code. Unaffected work continues.
Each entry states the ACA's recommendation so the Director can answer "yes".

| ID | Severity | Question | Evidence | Recommendation | Blocks |
|---|---|---|---|---|---|
| AMB-01 | 🔴 | The **public** repository contains personal data of named minors and staff (see `SOURCE_INVENTORY.md` §5). Remove/relocate? | GitHub API 200 unauthenticated; files listed in inventory §5 | Make the repository private **or** move these files to IDSS internal storage; then decide whether to purge history (history rewrite needs separate approval, M-23). Until then EGE never imports them. | nothing in code; legal risk now |
| AMB-02 | 🟡 | Are the catalogues in the repo (Math 2022, B/H/S 2022/23, German 2024) the **currently published** editions for 2025/26 and 2026/27? | C5 §3.3: ministry publishes catalogues at mo.ks.gov.ba ≥ 6 months before the exam | Director confirms via mo.ks.gov.ba; they are registered as `candidate_active` until confirmed, then activated through the Superadmin flow | trusted activation of question bank |
| AMB-03 | 🟡 | Do **all** IDSS Grade 9 students take **German** as subject (c) "first foreign language"? | C1 Art. 5(c); A3 lists B/H/S, German, Math for IDSS; C8 shows English exists for other schools | Yes for IDSS; model subject (c) per student enrolment anyway, with German the only one currently backed by a canon catalogue | student subject assignment |
| AMB-04 | 🟡 | German listening: no official audio is in the repo (only transcripts). May we (a) show transcripts only, (b) record IDSS audio from transcripts, (c) use TTS? | C14 §4.1 transcripts; C5 §4.6 listening is part of the test | (a) now, clearly labelled; (b) later as IDSS level-5 material linked to the transcript. No TTS presented as official audio | listening practice |
| AMB-05 | 🟡 | Is exam **administration** (commissions, EMIS, forms EM1–EM11, sessions) in EGE scope, or only student preparation + staff support? | Mandate §2 focuses on preparation/support; prototype built admin tooling; C5 defines forms | Keep EGE to preparation + support; register forms EM1–EM11 as canonical documents (versioned) but build generators only on explicit request | prototype admin features |
| AMB-06 | 🟢 | Official IDSS **usernames**: mandate says "username + password". Is the username the e-mail for staff and a school-issued ID for students? | §7A.1 lists staff e-mails only | Staff: e-mail as username; students: school-issued username (no e-mail required — data minimisation) | Sprint 1 auth |
| AMB-07 | 🟢 | Is `CODE-PROTOTYPE/public/logo_white.png` byte-identical to the official asset URL? | URL blocked by build-environment egress policy (403, twice) | Director (or a session with web access) confirms; until then the prototype file is used as the candidate official logo | splash, favicon |
| AMB-08 | 🟢 | The splash visual reference **`Untitled blend.jsx`** was not supplied (not in repo or session). | INSTRUCTION §7A.9 | Director uploads it to `docs/mandate/`; splash is designed from the written requirements until then | splash polish (not the splash itself) |
| AMB-09 | 🟢 | Math **level labels** for mock exams: catalogue §2 says tasks 1–4 basic, 5–8 medium, 9–10 advanced; §2 p.5 also says basic = catalogue tasks 1–5 per area. Mock tests draw test task 1–4 from catalogue 1–5, 5–8 from 6–15, 9–10 from 16–20? | C12 §2 pp.4–5 | Yes — that is the literal reading of C12 p.5 ("Komisija … prva četiri zadatka … iz osnovnog nivoa …"). Confirm with a Math teacher (Haris Hamzić) | mock-exam generator (Math) |
| AMB-10 | 🟢 | B/H/S and German mock tests: catalogue gives test composition but not which catalogue areas feed which test positions. | C13 §3, C14 §2; real 2026 tests C15–C16 | Derive the blueprint from the four official 2026 tests per subject, record it as IDSS-reviewed level-5 data, reviewed by the subject teachers | mock-exam generator (B/H/S, German) |
| AMB-11 | 🟢 | Language of UI beyond Bosnian: prototype has `bs/de/en`. Required? | INSTRUCTION §16 "primarily Bosnian" | Bosnian only in Sprint 1; i18n layer ready for `de`/`en` later | none |
| AMB-12 | 🟢 | Commander automation (hooks, skills, CI guard from the `commander` repo) could not be installed: the session's safety policy blocked cloning executable code from the external repo. | Commander initial_instructions Step 3.3 | Director installs via `automation\install-automation.bat` locally, or approves the install in a session | E-13 enforcement |

## Resolutions — Director, 2026-09-27

| ID | Decision | Consequence |
|---|---|---|
| AMB-01 | Repository **stays public** for now. | Files stay; EGE never imports them (P-4 personal-data rule in `CLAUDE.md` stays). Re-raise before real student data enters the app. |
| AMB-02 | Repository catalogues are **valid until the ministry (MOOKS) issues new ones**. | The three catalogues are activated as the current canonical versions in Sprint 02 seeding. A new ministry catalogue goes through the Superadmin upload/supersede flow. |
| AMB-03 | **All IDSS students take German** as subject (c). | German is the default first-foreign-language subject of every enrolment (the field stays in the model, P-2). |
| AMB-04 | **Reconstruct listening audio from the printed transcripts.** | Audio assets are IDSS level-5 material linked to the transcript and labelled "IDSS rekonstrukcija — nije službeni audio zapis". Method (recorded voices vs. speech synthesis service) is a new external dependency → decided at the listening sprint (M-4). |
| AMB-05 | Focus is **student preparation** with questions simulated strictly from the canonical subject catalogues (B/H/S, German, Mathematics). | Exam administration (commissions, EMIS, EM forms, session planning) is **out of scope**. Prototype admin features in that area are not ported. |
| AMB-06 | Staff: e-mail as username; students: school-issued username, no e-mail. | PDL-003 confirmed. |
| AMB-07 | Official logo supplied by the Director. | Stored as `public/brand/idss-logo.png` (colour, for light backgrounds) and used by the splash; `logo_white.png` kept for dark backgrounds. |
| AMB-08 | `Untitled blend.jsx` supplied. | Stored as reference in `docs/mandate/splash-reference/`; the final IDSS-native splash is in `public/splash/`. |
| AMB-09 | Confirmed: Math test tasks 1–4 from catalogue tasks 1–5 (basic), 5–8 from 6–15 (medium), 9–10 from 16–20 (advanced). | Blueprint data with source C12 p.5; **to be confirmed by Haris Hamzić** in the review queue before activation. |
| AMB-10 | Derive B/H/S and German blueprints from the four official 2026 tests per subject; level-5 data reviewed by subject teachers. | Blueprint derivation task in Sprint 07; reviewers: Nizama Memija (B/H/S), Nikolina Todorović (German). |
| AMB-11 | **Everything shown is displayed instantly in the language chosen by the user**, at any moment, for all roles. | Live language switch (bs/de/en) without reload for all UI, messages, system and generated content. See AMB-13 for canonical source text. |
| AMB-12 | Commander automation install approved. | Installed from tag v1.6.1 (hooks, skills, CI guard, guard config). |

## New items

| ID | Severity | Question | Evidence | Recommendation | Blocks |
|---|---|---|---|---|---|
| AMB-13 | 🟡 | ⚠️ AMB-11 vs. mandate §16 / P-4: should **canonical question text** (e.g. a B/H/S literature question, a German reading text) also switch language? Translating would change what the exam tests and would be an unofficial paraphrase. | Mandate §16 "academic material should preserve the language of its authoritative source"; §13A "never overwrite canonical source text" | Everything switches language **except** the canonical question/answer text, which always stays in its source language; instructions, hints, feedback and explanations around it switch. An optional, clearly labelled "pomoćni prijevod" could be added later for Math only. | practice UI (Sprint 06) |
| AMB-14 | 🟢 | Which UI languages exactly? | Prototype had bs/de/en; Director did not list them | bs (default), de, en | none — implemented as assumption |

## Resolutions — Director, 2026-09-27 (second round)

| ID | Decision | Consequence |
|---|---|---|
| AMB-13 | **Everything is translated except the text of the official question and its answer.** Instructions, hints and explanations around the question are translated. | `question_versions.raw_text`, options and answer keys are always shown in the source language; every surrounding UI string, hint, feedback and explanation follows the chosen language. |
| AMB-14 | Implicitly confirmed with AMB-13: bs (default), de, en. | — |
| — | Supabase project provided by the Director: `dezevstfmfliyasdeflj` (https://dezevstfmfliyasdeflj.supabase.co). | Used for all environments until the Director says otherwise. |

## New items (Sprint 01, account administration)

| ID | Severity | Question | Evidence | Recommendation | Blocks |
|---|---|---|---|---|---|
| AMB-15 | 🟢 | Minimum password length for **student** accounts? | Mandate §7A.5 requires passwords but sets no length | 📌 ASSUMED 12 (same as staff); a shorter minimum (e.g. 10) is easier for Grade 9 students. Constant `STUDENT_PASSWORD_MIN_LENGTH`. | none |
| AMB-16 | 🟢 | Subject-teacher rights need a subject scope, but exam subjects become database rows only in Sprint 04 (derived from the active rulebook). | DATA_MODEL §4; P-3 | Until then Haris Hamzić, Nikolina Todorović and Nizama Memija get `admin_operations`; `subject_teacher` is granted per subject in Sprint 04. | canon review by teachers |

## Resolutions — Director, 2026-09-27 (third round)

| ID | Decision | Consequence |
|---|---|---|
| AMB-15 | Minimum student password length = **10** characters. | `STUDENT_PASSWORD_MIN_LENGTH = 10`; staff stays 12. Applies to account creation and password reset. |

## New items (review of documents added 27.09.2026)

| ID | Severity | Question | Evidence | Recommendation | Blocks |
|---|---|---|---|---|---|
| AMB-17 | 🟡 | Besides mock exams built only from official catalogue tasks, may the platform offer **practice variants** (e.g. the same Math task with other numbers, a new German sentence with the same grammar point)? | C21 III: the real test uses only catalogue tasks; P-4 forbids inventing canon; AMB-05 "simulated strictly from the catalogues" | **Mock exams: only official catalogue tasks, never variants** (mirrors the real exam). Practice mode: optional variants only if generated from a catalogue task, checked automatically (Math: recomputed answer) and **approved by the subject teacher** before any student sees them, always labelled "Vježba (nije službeno pitanje)". Default until decided: no variants. | practice variants (Sprint 05/06) |
| AMB-18 | 🟢 | The calendar, timetable, enrolment criteria and matura decision in the repository are for 2024/25 and 2025/26; the 2026/27 editions (matura June 2027) are not yet published. | C20–C24 dates | Register them as dated canon (ministry instruction / rulebook types) for reference; show dates and enrolment points only from the edition valid for the student's school year; upload the 2026/27 editions through `/app/kanon` when the ministry publishes them. | calendar/countdown, enrolment-points explanation |

## Resolutions — Director, 2026-09-27 (fourth round)

| ID | Decision | Consequence |
|---|---|---|
| AMB-17 | **Mock exams never contain variants** (the real matura does not either). In practice a variant may appear **only if the subject teacher approves it** and it is clearly labelled "Vježba (nije službeno pitanje)". Until the variant workflow exists, there are no variants. | EXAM_SIMULATION §5 binding; variant generation needs teacher approval per item, a visible label, and is excluded from mock-exam blueprints by design. |
| — | Catalogue files renamed to one naming pattern: `Ispitni katalog za Matematika.pdf`, `Ispitni katalog za BHS jezik.pdf`, `Ispitni katalog za Njemački jezik.pdf`. | Content unchanged (same SHA-256), so the registry, parser profiles and ingestion are unaffected; references updated. |

| AMB-19 | 🟢 | (Resolved 27.09.2026: the Director confirmed the five text revisions MAT-5.3.5, 5.4.20, 5.9.13, 5.10.6, 5.10.20 in the review screen; verified in the database, no footnote text remains in text, stem or options. DEU-4.2.5 unchanged, its web address is printed reading text. PDL-021. Still open for the next catalogue edition: exclude footnote bands in the parser profile.) Six trusted questions (Math MAT-5.3.5, 5.4.20, 5.9.13, 5.10.6, 5.10.20 and German DEU-4.2.5) carry page footnote text (source references, links) inside their extracted text; seen in the Director's first live search (27.09.2026). | ingested records; review screen | Before students see questions (Sprint 06): correct the displayed text by a reviewed text revision (`normalized_text`, ARCHITECTURE §5) and exclude footnote bands in the parser profile for the next edition; the printed source stays untouched. | practice display, search index |
| AMB-20 | 🟢 | (Update 27.09.2026: version 2.0 at the Director's request, professional level with GDPR focus; school data protection officer gdpr@idss.ba, +387 33 267 965; BiH Law on Personal Data Protection, Official Gazette of BiH 12/25; supervisory authority Agencija za zaštitu ličnih podataka u BiH. Version 2.1: IDSS identity (Buka 13, 71000 Sarajevo, ID number 4202220420007, MBSU 65-05-0013-16), court in Sarajevo and retention of security records "in accordance with the law" confirmed by the Director. To confirm once in use: processors Vercel and Google.) Footer documents (Terms of Use, Privacy Policy, Subscription, Cookie notice) requested by the Director 27.09.2026. | Director request | Resolved 27.09.2026: texts written by ACA at the Director's request (`content/legal/{bs,de,en}.json`, version 1.0), facts confirmed by the Director: use free for IDSS students; consent through the school's enrolment documents; retention until the end of the school year plus one year; Gemini may receive catalogue text and query text, never identity or results. Street address and registration number of IDSS can be added when the Director provides them; a legal review by the school is recommended before production. | legal pages, production launch |
| AMB-21 | 🟡 | Automatic checking of matching, completion, word-bank and short-answer tasks: the printed keys are text in several formats (e.g. "_b_ influenser", "Ausdauertraining/Krafttraining" where "/" may mean alternatives or both). | practice, mock-exam pre-scoring | Until a subject teacher confirms the format per task type, these answers go to the teacher with the printed solution shown after the answer (PDL-024); no interpretation of key formats by the application. | practice feedback, PDL-018 pre-scoring |
| AMB-22 | 🟡 | Mathematics mock exam: C12 p.5 fixes the level of every position (1-4 basic, 5-8 medium, 9-10 advanced) but not the areas. May two positions come from the same area? And may position 9 or 10 be an advanced task without parts a/b (10 of 50), scored 1 point whole? | C12 pp.4-5; no official 2026 Math test in the repository | IDSS proposal: ten different areas in one test (each area once); advanced tasks without parts allowed, scored 0 or 1. Confirm with Haris Hamzić (blueprint confirmation in the app) | mock exam generator (Math) |
| AMB-23 | 🔴 | German catalogue (C14) items whose printed key is wrong or not the only defensible answer (Director, 2026-10-03: "find the ambiguous question"). **DEU-4.3.34** "Mozarts Geburtshaus liegt in": options a) Salzburg in Deutschland, b) Wien in Österreich, c) Salzburg in Österreich; printed key a) (C14 p.65), but Salzburg is in Austria, so c) is the only true statement and a) is false. The app checks practice and mock exams by the effective key, so a student who answers correctly (c) is marked wrong. Also open to two answers: **DEU-4.5.10 item 1** "Ich besuche am Wochenende oft meine Eltern": key 3) "Wen besuchst du oft am Wochenende?", but 2) "Was machst du oft am Wochenende?" also fits; **DEU-4.3.30** "Unserem Skifahrer schenken wir zum Geburtstag": key c) eine Brille (ski goggles), a) eine Sonnenbrille is also defensible; **DEU-4.5.10 item 3** "Ich gehe im Sommer gerne schwimmen": key 2), 3) "Welche Sportart magst du am liebsten?" is also possible. | C14 pp.46, 65; catalogue text and keys | DEU-4.3.34: a German teacher (Nikolina Todorović) records a key revision c) with reason and evidence in the review screen (CF-03); until then the item should not be auto-checked. The other three: the teacher decides whether the printed key stays (the official test is scored by it) or a revision accepts both answers. Nothing is changed without the teacher (P-4). | practice and mock exam checking (German) |
