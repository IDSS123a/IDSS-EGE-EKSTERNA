# Source Inventory and Evidence Map — IDSS EGE

Status: Sprint 00 (discovery) · Date: 2026-09-27 · Author: ACA (Claude Code)
Scope: every file in `IDSS123a/IDSS-EGE-EKSTERNA` at commit `711dd8d` (plus the
mandate `INSTRUCTION-WEB-APP-IDSS-EGE.html`, supplied by the Director in session).

How this was produced: every PDF was opened with PyMuPDF; text-layer PDFs were
extracted directly, image-only PDFs were OCR'd (Tesseract 5, `bos+hrv`); DOCX/XLSX
were read with python-docx/openpyxl. Nothing was paraphrased into the canon.
Page numbers below are PDF page numbers unless stated as "printed p.".

> **Personal data notice.** Several files contain personal data of named minors
> and staff (see §5). This document intentionally does not reproduce any of it.

---

## 1. Authority hierarchy used (INSTRUCTION §4)

| Level | Source class | Controls |
|---|---|---|
| 1 | Law / regulation (Pravilnik) / official decision | legal requirements |
| 2 | Official external-matura documentation (Uputstvo, Instrukcija, ministry letters) | exam organisation and procedure |
| 3 | Official subject catalogues (Ispitni katalog) | subject content, question universe, test structure |
| 4 | Official exam tests / answer keys / examples | documented patterns |
| 5 | IDSS-internal material (reports, role checklists, forms filled by IDSS) | supports; never overrides 1–4 |
| 6 | Prototype code (`CODE-PROTOTYPE/`) | implementation ideas only; not an authority |

---

## 2. Canonical documents (levels 1–4)

| # | File | Type | Lvl | Scope | Version / date evidence | Key content for EGE | Features affected |
|---|---|---|---|---|---|---|---|
| C1 | `OSTALI-DOKUMENTI/Prečišćeni tekst Pravilnika.docx` | Rulebook, consolidated text | 1 | all subjects | Consolidates Pravilnik "Sl. novine KS" 25/18 with amendments (17/19, 24/19 per ministry citation in `Komisije.pdf`) | **Art. 5: matura = three subjects: (a) B/H/S jezik i književnost, (b) Matematika, (c) first foreign language the student learned in primary school.** Art. on duration: 60 min per subject; max two subjects per day; results published by 19h, final within 24h; points-equivalent rule for justified absence; recognition of matura from outside KS | subject scope, exam engine timing, mock-exam rules |
| C2 | `OSTALI-DOKUMENTI/3. Pravilnik_o_polaganju_eksterne_mature.pdf` | Rulebook (original) | 1 | all | PDF 2022-01-26; 8 pages; text layer | Original text of C1 (Art. 5 identical) | as C1 |
| C3 | `OSTALI-DOKUMENTI/3.a. Pravilnik_o_izmjenama_pravilnika….pdf` | Official Gazette issue (amendment) | 1 | all | "Službene novine KS", 25 Apr 2019; text layer has broken font encoding → OCR used | Amendment to the Pravilnik (inside a full gazette issue; relevant pages not yet isolated) | provenance of C1 |
| C4 | `OSTALI-DOKUMENTI/3.b. Pravilnik_o_izmjenama_i_dopunama….pdf` | Official Gazette issue (amendment) | 1 | all | "Službene novine KS" br. 24, 13 Jun 2019; image-only → OCR | Adds recognition of matura passed outside KS (Art. 5 subjects) | provenance of C1 |
| C5 | `OSTALI-DOKUMENTI/Uputstvo_Za_Provodjenje_Eksterne_Mature_2026.pdf` | Ministry instruction | 2 | all | Broj 11-04/03-34-6442-8/26, 27.03.2026, school year 2025/26; image-only → OCR (46 pp.) | Catalogues published by the ministry at mo.ks.gov.ba ≥ 6 months before the exam (§3.3); test duration 60 min; late arrival for the first-foreign-language test forfeits the listening part and its points (§4.6); scoring by ministry key via EMIS; forms EM1–EM11 | canon versioning, German listening, mock-exam rules, official forms |
| C6 | `OSTALI-DOKUMENTI/Instrukcija_Eksterna_Matura_2026.pdf` | Ministry instruction | 2 | all | Broj 11-04/03-34-6442-7/26, 27.03.2026; image-only → OCR | Adapted conditions for students with developmental difficulties/disabilities (2025/26) | accessibility/accommodations (support tools) |
| C7 | `OSTALI-DOKUMENTI/Za_Ucenike_IPP.pdf` | Ministry letter | 2 | all | Broj 11-34-10847-4/25, 27.05.2025; image-only → OCR | Matura for students on IPP/IEP programmes | accommodations |
| C8 | `OSTALI-DOKUMENTI/6. Instrukcija - eksterna matura - satnica.pdf` | Ministry instruction (timetable) | 2 | all | Broj 11-07/03-34-10847-3/25, 09.06.2025 (school year 2024/25) | 2025 timetable; lists **Engleski jezik** and **Njemački jezik (for students who learned German)** as separate first-foreign-language tests | confirms subject (c) is the student's own first foreign language |
| C9 | `OSTALI-DOKUMENTI/4. Uputstvo - Eksterna matura - 2025. godina.pdf` | Ministry instruction | 2 | all | PDF 2025-05-19, 44 pp., text layer | 2024/25 edition of C5 | superseded by C5 for current operation; historical |
| C10 | `OSTALI-DOKUMENTI/Uputstvo - Eksterna matura - 2023.pdf` | Ministry instruction | 2 | all | PDF 2023-04-10, 44 pp. | 2022/23 edition | historical |
| C11 | `OSTALI-DOKUMENTI/Dopisi i odgovori Ministatstva za eksternu maturu.pdf` | Correspondence IDSS ↔ ministry | 2 (ministry replies) / 5 (IDSS letters) | all | Dec 2024; image-only → OCR | IDSS request to exempt recently-arrived foreign-national students; ministry answers | student lifecycle (exempt students) |
| C12 | `matematika_-_katalog.pdf` | Subject catalogue | 3 | Mathematics | PDF 2022-08-19, 75 pp., text layer | 10 areas × 20 tasks = **200 tasks with answers**; levels osnovni (1–5, MC 4 options), srednji (6–15), napredni (16–20); test = 10 tasks, 10 points, 60 min; tasks 1–8 = 1 pt, 9–10 = 0.5 pt per part a)/b); no calculators; formula overview §4 | question bank, exam engine, mock exam |
| C13 | `bjk_hjk_sjk_katalog_eksterna_matura_2022_2023.pdf` | Subject catalogue | 3 | B/H/S | "2022/2023" in filename; PDF 2022-08-21, 89 pp. | **200 questions with solutions** in 9 areas (Književnost 48, Medijska kultura 12, Fonetika i fonologija 25, Morfologija 33, Tvorba riječi 10, Sintaksa 30, Leksika 10, Pravopis 24, Historija jezika 8) + 20 supplementary "U susret kurikularnoj reformi" tasks; test = 18 questions (12 MC, 4 completion, 2 matching), 10 points, 60 min; reading list §2 | question bank, exam engine, learning content |
| C14 | `Ispitni katalog za Njemački jezik.pdf` | Subject catalogue | 3 | German | PDF 2024-07-26, 76 pp. | 5 areas × 2 points (Hörverstehen, Leseverstehen, Wortschatz, Grammatik, Kommunikation); 0.50 points per item; 60 min; no dictionaries; target CEFR A2.2; **200 scored items** (50 multi-item tasks × 4 + 40 Wortschatz items) with solutions; listening transcripts printed, **no audio** | question bank, exam engine, listening practice |
| C15 | `OSTALI-DOKUMENTI/A - Test B1.pdf`, `B - Test B2.pdf`, `C - Test B3.pdf`, `D - Test B4.pdf` + `… Rješenje testa B1–B4.pdf` | Official exam tests + keys | 4 | B/H/S | PDF 2026-06-02 (school year 2025/26) | Real 2026 test variants B1–B4 and keys | mock-exam structure validation; regression of catalogue coverage |
| C16 | `OSTALI-DOKUMENTI/NJEMAČKI JEZIK - TEST 1A/1B/1C/1D.pdf` | Official exam tests | 4 | German | PDF 2026-06-08, "Eksterna matura 2025/2026" | Real 2026 German test variants (no keys in repo) | mock-exam structure validation |
| C17 | `OSTALI-DOKUMENTI/Prigovor … EM9 - Njemacki.pdf`, `EM9-PASIC.pdf/.docx` | Official form EM9 (filled) | 2 (form) / personal data | German | June 2026 | Complaint form structure (EM9) — **filled with a named student's data** | official-forms register only |
| C18 | `OSTALI-DOKUMENTI/Obrazac EM11 - OŠ.xlsx`, `Kopija Obrazac EM11 - OŠ.xlsx` | Official form EM11 (result list) | 2 | all | two files with identical extracted content but different bytes ("Kopija" = copy) | Result list template per subject | official-forms register |
| C19 | `OSTALI-DOKUMENTI/EKSTERNA IPP OBRAZAC TESTA.docx`, `… RJEŠENJE TESTA.docx` | Official template (IPP adapted test) | 2 | all | 2025/26 | Header/score table template for adapted tests | accommodations, official forms |
| C20 | `OSTALI-DOKUMENTI/Odluka o kriterijima--.pdf` | Government decision ("Službene novine KS" 11/25, 20.03.2025, Broj 02-04-7346-7/25) | 1 | enrolment 2025/26 | text layer; published with the 2025 notice (C24) | **How matura points count for secondary-school enrolment:** max 111 points (Art. 10); school results max 100 = general success VI–IX ×2.60 (max 52) + three significant subjects VIII–IX ×0.80 (max 24) + **external matura points ×0.80 (max 24)** (Art. 12); matura-points equivalent without matura: sum of final grades VI–IX per subject ×0.50 (Art. 18(4)); minimum 78 points for gimnazija, 71 for health/economics schools (Art. 17); B/H/S, Matematika and first foreign language are the significant subjects for gimnazija (Art. 11) | enrolment-points explanation for students (later sprint), motivation |
| C21 | `OSTALI-DOKUMENTI/ODLUKA  EKSTERNA MATURA ŠK 25 26.pdf` | Ministerial decision (Broj 11-04-34-50150/25, 20.10.2025) | 2 | all, school year 2025/26 | scan, no text layer (read visually); page 2 blank | Matura is mandatory at the end of the final grade in 2025/26 (I–II); **point III: tests are created exclusively from the tasks of the official exam catalogues published on the ministry website**; matura bodies appointed per Pravilnik Art. 27 (25/18, 17/19, 24/19) | **confirms the mock-exam design: tests only from catalogue tasks**; canon registry |
| C22 | `OSTALI-DOKUMENTI/KALENDAR AKTIVNOSTI 2025.pdf` | Ministerial decision (Broj 11-07/04-34-7074/25, 28.02.2025) | 2 | 2024/25 cycle | text layer | Calendar 2025: end of classes 3.6.; **matura 17.–18.6.2025**; results entry 19.–20.6.; enrolment rounds 23.6.–4.7. | countdown/calendar feature (needs the 2026/27 edition) |
| C23 | `OSTALI-DOKUMENTI/Termini_Odrzavanja_Eksterne_Mature.pdf` | Ministry web notice (print of mo.ks.gov.ba, captured 27.09.2026) | 2 | 2024/25 cycle | no text layer (read visually) | 17.06.2025: B/H/S 9–10h, Matematika 11–12h; 18.06.2025: Engleski 9–10h, **Njemački 9–10h (for students who learned German as first foreign language)**; every test 60 minutes | consistent with C1 (60 min, max two subjects per day), C8 and AMB-03 |
| C24 | `OSTALI-DOKUMENTI/Eksterna matura - Informacija za učenike koji su osnovno obrazovanje završili izvan Kantona Sarajevo.pdf` | Ministry web notice (print, captured 27.09.2026) | 2 | 2024/25 cycle | no text layer (read visually) | Students from outside KS or foreign programmes take the matura in one of six named schools; registration deadline 10.06.2025 (extended to 13.06.2025); nostrification via form N/E 1; refers to C20 | out of scope for IDSS students (AMB-05); informational |

## 3. Administrative / institutional documents (levels 2 and 5)

| # | File | Type | Lvl | Content | Relevance |
|---|---|---|---|---|---|
| A1 | `OSTALI-DOKUMENTI/Komisije.pdf` (126 pp., image-only) | Ministry decisions forming school commissions (all KS schools) | 2 | Names of commission members across schools (personal data of staff) | none for student product; out of scope |
| A2 | `OSTALI-DOKUMENTI/ŠMK - 1. dio.pdf`, `ŠMK - 2. dio.pdf` (84 + 60 pp., image-only) | School matura commission documents | 2 | Commission paperwork (first pages OCR'd only) | out of student scope; archive |
| A3 | `OSTALI-DOKUMENTI/7. LISTA NASTAVNIKA_KOMISIJA….pdf` | IDSS proposal of commission members | 5 | Staff names; IDSS student counts per subject (B/H/S, **Njemački jezik**, Matematika) | confirms IDSS students take German as subject (c) |
| A4 | `OSTALI-DOKUMENTI/0. Predsjednik_…pdf`, `1. EMIS_…pdf`, `2. Clan_…pdf`, `Eksterna_Matura_Priprema_I_Provodjenje.xlsx` | IDSS role checklists (2024/25) | 5 | Duties of commission president, member, EMIS person | admin operations (out of student core) |
| A5 | `OSTALI-DOKUMENTI/MOOKS_Sifre.pdf` | Ministry e-mail (June 2025) | 2 | Distribution e-mail; contains many third-party e-mail addresses | none; personal data |
| A6 | `OSTALI-DOKUMENTI/Eksterna_Matura_Izvjestaj_BHS-Njemacki_17062026.docx` | IDSS internal report | 5 | 2026 results report (student initials, results) | historical analytics evidence; personal data |
| A7 | `OSTALI-DOKUMENTI/Ucenici-Imena_Bar-Kodovi-Rezultati.docx` | IDSS internal notes | 5 | Named students, test groups, scoring disputes — documents that an **official ministry key contained an error** in 2026 | evidence for answer-key conflict handling; personal data |
| A8 | `OSTALI-DOKUMENTI/IDSS_Ispit_Ne_Smetaj.docx` | IDSS signage | 5 | empty/1 character of text | none |

Administrative additions (27.09.2026), level 2, outside EGE scope (AMB-05), no personal data:
`Obrazac Zahtjev za Nostrifikaciju.pdf` (blank form N/E 1), `upute_o_popunjavanju_uplatnice (1).pdf` and
`Iznos uplate.jpg` (fees: nostrification 100 KM, equivalence 50 KM per grade; public budget account),
two `.url` shortcuts to mo.ks.gov.ba (taxonomy 14 and 15: enrolment and external matura pages).

## 4. Non-canonical project material (level 6 and mandate)

| File | Role |
|---|---|
| `CODE-PROTOTYPE/**` | Reference implementation — see `PROTOTYPE_AUDIT.md` |
| `CODE-PROTOTYPE/public/logo_white.png` = `favicon.png` = `src/assets/images/logo_white.png` | 12,610-byte PNG; byte-identical copies; presumed official IDSS logo (331×101 RGBA). The official URL https://idss.edu.ba/wp-content/uploads/2024/03/logo_white.png could not be fetched from the build environment (egress policy, 403 twice) — byte comparison pending (AMB-07) |
| `CODE-PROTOTYPE/src/assets/images/*_17904….jpg` (5 files, ~4.2 MB) | AI-generated-looking crests/heros ("school_emblem_crest", "certificate_seal_gold"); **not** the official mark — must not be used as the IDSS logo (INSTRUCTION §17) |
| `AA.md`, `CODE-PROTOTYPE/AA.md` | 1-byte placeholder files |
| `INSTRUCTION-WEB-APP-IDSS-EGE.html` | Project mandate (not in repo; added to `docs/mandate/` in this sprint) |
| `Untitled blend.jsx` (splash visual reference) | **Not present** in the repository or the session — AMB-08 |

## 5. Personal-data exposure (GDPR) — 🔴 requires Director decision

The repository is **public** (GitHub API returns 200 without authentication, checked
2026-09-27). The following tracked files contain personal data of named minors
and/or staff:

- `OSTALI-DOKUMENTI/Ucenici-Imena_Bar-Kodovi-Rezultati.docx` (student names, test groups, scoring details)
- `OSTALI-DOKUMENTI/EM9-PASIC.docx`, `OSTALI-DOKUMENTI/EM9-PASIC.pdf`, `OSTALI-DOKUMENTI/Prigovor na broj bodova … EM9 - Njemacki.pdf` (named student's complaint)
- `OSTALI-DOKUMENTI/Eksterna_Matura_Izvjestaj_BHS-Njemacki_17062026.docx` (initials + results)
- `OSTALI-DOKUMENTI/Komisije.pdf`, `ŠMK - 1./2. dio.pdf`, `7. LISTA NASTAVNIKA….pdf` (staff names)
- `OSTALI-DOKUMENTI/MOOKS_Sifre.pdf` (third-party e-mail addresses)

Removing them from the working tree is reversible; removing them from Git history
is a history rewrite (M-23) and visibility change is an outward-facing action — both
need explicit Director approval. Recorded as AMB-01.

## 6. Verified canonical facts (for seeding, never for hard-coding)

These facts will be stored as **data derived from the active canonical version**
(`canonical_rules` rows with provenance), not as constants in code.

| Fact | Value | Source |
|---|---|---|
| Exam subjects | B/H/S jezik i književnost; Matematika; first foreign language learned (IDSS: Njemački jezik) | C1 Art. 5; C8; A3 |
| Duration per subject test | 60 minutes | C1; C5 §4.5; C12 §3; C13 §4; C14 §3 |
| Points per subject test | 10 | C12 §3; C13 §4; C14 §2–3 |
| Math test composition | 10 tasks: 1–4 basic MC (1 pt), 5–8 medium (1 pt), 9–10 advanced (0.5 pt per part a/b) | C12 §2–3 |
| B/H/S test composition | 18 questions: 12 MC, 4 completion, 2 matching; first 16 = 0.5 pt; matching partial credit rule | C13 §3–4 |
| German test composition | 5 areas × 2 points; 0.50 points per item; listening first | C14 §2–3; C5 §4.6 |
| Allowed / forbidden aids | graphite pencil + eraser while working; final in blue/black pen; no phones/calculators (Math), no dictionaries (German) | C12 §3; C13 §4; C14 §3 |
| Catalogue question universe | Math 200 tasks; B/H/S 200 questions (+20 supplementary); German 200 items | C12 §2; C13 Uvod; C14 (counted) — see `tools/canon-ingestion/output/INGESTION_REPORT.md` |
| Pass threshold | **none defined** — the matura score is a component of secondary-school enrolment (C1) | C1 |
| Source of test tasks | Tests are created **exclusively** from the official catalogue tasks | C21 point III (2025/26) |
| Matura total | 30 points (3 subjects × 10); consistent with the enrolment formula (×0.80 = max 24) and the equivalent (4 grades × 5 × 0.50 = 10 per subject) | C12–C14; C20 Art. 12, 18 |
| Weight in enrolment | external matura ×0.80 = max 24 of 111 enrolment points; gimnazija minimum 78 | C20 (for enrolment 2025/26) |

## 7. Conflicts found between sources

| ID | Conflict | Resolution status |
|---|---|---|
| CF-01 | Prototype defines 5 exam subjects (adds English, Physics), 90-minute exams, 100 points, 50 % pass threshold | Prototype is level 6 → overruled by C1/C12–C14. Not carried forward. |
| CF-02 | Prototype knowledge base cites laws/articles ("Član 88/89", "Pravilnik … 2025", IDSS "Ustav") that do not exist in the repository | Treated as fabricated; excluded from the canon. |
| CF-03 | An official 2026 B/H/S answer key was disputed by IDSS (A7) | Answer keys can be wrong → data model must allow a reviewed correction with provenance, never silent overwrite (see architecture). |
| CF-04 | Catalogue editions (Math 2022, B/H/S 2022/23, German 2024) vs. C5 requiring catalogues for 2025/26 | Currency unverified → AMB-02. |
| CF-05 | C20–C24 describe the 2024/25 or 2025/26 cycles; the cohort served now sits the matura in June 2027 (school year 2026/27) | No contradiction with the system; dates and enrolment rules are per school year → registered as dated data, next editions expected (AMB-18). |
