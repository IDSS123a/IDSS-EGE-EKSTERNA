# Pre-deployment audit and release gate (2026-10-04)

Requested by: the Director ("ACA MASTER DIRECTIVE, pre-deployment system audit, security validation and release gate").
Mode: plan and audit. No code was changed, no production migration was run, no data was deleted, nothing was
deployed. Governance read first: `CLAUDE.md`, `CONSTITUTION.md` (P-1 to P-15), `AGENTS.md`, `DECISION_LOG.md`,
`CHANGELOG.md`, `README.md`, `.commander-version` (1.6.2). The directive and the constitution agree (M-4, M-23):
destructive work and the deploy need the Director's explicit approval.

## A. Executive decision

**BLOCKED.**

One finding meets the directive's non-negotiable gate (section 5.3): **F-01**. 492 of the 500 questions that pupils
can practise were accepted in one bulk transaction under the Director's account, by his order (PDL-016,
2026-09-27), without an individual comparison by a subject teacher. The technical gate itself holds: no unreviewed
record, no answer key and no unconfirmed content reaches a pupil through any path we tested. The open point is the
human gate. Only the Director can lift this block, by one of the options in section D.

Several mandatory checks could not run from this environment (section B.4). Even after F-01 is resolved, the
decision becomes **CONDITIONAL, NOT APPROVED** until F-03 and F-04 are settled, because those checks can only be
done by the Director in the Supabase dashboard. No release-blocking security defect was found. This recommendation
is not permission to deploy.

## B. Technical findings

### B.1 Commit and baseline
| Item | Value |
|---|---|
| Branch audited | `claude/new-session-81hd0x` |
| Commit | `d4b70ba5748222e62569efec8bb055df0b0b8897`; its tree is identical to `origin/main` `075d9e3` |
| Working tree | clean (ignored only: `.next/`, `next-env.d.ts`, `test-results/`, `__pycache__/`, `tsconfig.tsbuildinfo`) |
| Toolchain | Node 22.22.2, npm 10.9.7, Next.js 16.3.6, React 19.2.8, TypeScript strict |
| Live project | Supabase `dezevstfmfliyasdeflj`, PostgreSQL 17.6, eu-central-1, ACTIVE_HEALTHY |
| Live migrations | 001 to 034 all recorded (024 recorded after 026; 030 run by the Director and recorded 2026-10-04) |

### B.2 Repository map (verified)
| Area | Files | Classification |
|---|---|---|
| `src/` | 217 | Production application (Next.js App Router, 38 pages and routes, server actions, features) |
| `migrations/` | 34 | Production schema; applied in order to a disposable PostgreSQL by `npm run test:db` |
| `public/` | 509 | Served assets: 500 question crops plus manifest, splash, brand, `sw.js` |
| `tests/` | 37 | Unit (Vitest), database (`tests/db`), end-to-end (Playwright) |
| `config/` | 6 | Canonical facts and parser profiles bound to catalogue SHA-256 (canon data with provenance) |
| `content/legal/` | 3 | Legal texts rendered by the app |
| `scripts/` | 4 | Bootstrap superadmin, canon seed, DB test runner, P-13 text check |
| `tools/` | 10 | Python ingestion evidence and crop renderer (offline tooling, excluded from build and lint) |
| `docs/`, `sprints/`, `corrections/`, governance files | | Records and governance; preserve |
| Root PDFs (3) | 3 | Official catalogues (canonical source); preserve |
| `OSTALI-DOKUMENTI/` | 67 | Official reference documents (38 MB); not used at run time; preserve |
| `CODE-PROTOTYPE/` | 49 | Historical prototype (reference level 6); excluded in `tsconfig.json` and `eslint.config.mjs`, imported nowhere |
| `.github/workflows/project-guard.yml` | 1 | CI: Commander project guard and P-13 text check only |

Integrations verified in code: Supabase (SSR client, service-role client server-only), Gemini REST (embeddings and
grounded answers, server-only), Web Push (`web-push`, VAPID), three.js (Vitrina only), pdf.js (ingestion).

### B.3 Build, type, lint and test results (actually executed at the audited commit)
| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | PASS |
| Lint | `npm run lint` | PASS |
| App text rule P-13 | `npm run check:text` | PASS (100 files) |
| Unit | `npx vitest run` | PASS (28 files, 176 tests) |
| Database and migrations | `npm run test:db` (PostgreSQL with pgvector, all 34 migrations, sections 1 to 28) | PASS (420 assertions) |
| Production build | `npm run build` | PASS |
| End-to-end | `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e` | PASS (86 tests, desktop and Pixel 7 profiles) |
| Dependencies | `npm audit` | Production: 0 vulnerabilities. Dev only: 5 high (eslint toolchain), F-07 |
| Unused dependencies | `npx depcheck` | PASS (none) |

### B.4 Not inspected or not runnable here, and why
| Check | Status | Reason |
|---|---|---|
| Load and stress tests | NOT RUN | No isolated copy of the backend; running load against the live project is not authorised |
| Live Gemini calls (keys, quota, injection against the real model) | NOT RUN | No keys in this environment (by rule) and outbound access to Google is blocked; covered by 33 unit tests with mocked responses |
| Attacks over HTTP against the public Supabase API | NOT RUN | The environment's network policy blocks the Supabase host; the same checks ran inside the database under the `anon` and `authenticated` roles (B.8) |
| Supabase Auth settings (public sign-ups, email confirmation, session lifetime) | INCONCLUSIVE | Not readable with the available tools; F-03 |
| Backup and point-in-time recovery | INCONCLUSIVE | Plan and backup settings not readable; F-04 |
| Real devices and browsers (iOS Safari, Firefox, Edge, macOS) | NOT RUN | Only Chromium with viewport emulation is available |
| Signed-in flows with real accounts end to end | NOT RUN | The ACA holds no passwords (standing rule); signed-in screens were checked with fixtures and the data layer live |
| Live push delivery to a device | NOT RUN | Needs a subscribed phone; planned as a post-deploy check with the first real assignment |
| Superadmin bootstrap | NOT RUN | Must not run against production; reviewed: refuses when a superadmin exists, removes a half-created user |

### B.5 Feature verification matrix
| Feature | Evidence | Status |
|---|---|---|
| Sign-in, lockout, forged cookie, fail-closed login | e2e `authentication.spec.ts`; unit `authentication.test.ts`; DB section 1 | PASS |
| Account administration (create, status, bundles, reset; no self or superadmin change) | unit `accounts.test.ts`; code review of `accounts/actions.ts` | PASS |
| Canon registry (upload, activate, supersede, rollback, history) | DB sections 5, 9; e2e `canon.spec.ts` | PASS |
| Ingestion and regression against the reference extraction | unit `ingestion-regression.test.ts` (500 records identical) | PASS |
| Teacher review, keys, key revisions, errata, follow-ups | DB sections 11, 14, 19; unit `review.test.ts` | PASS (technical gate); human gate F-01 |
| Search by words and by meaning (staff only) | DB sections 12, 15; unit `retrieval`, `gemini-*` | PASS with mocks; live NOT RUN |
| Practice (no key before answer, auto-check by effective key) | DB section 17; unit `practice.test.ts` | PASS |
| Mock exams (confirmed blueprint, teacher-approved set, grading, release) | DB section 18; unit `grading`, `exam-blueprints`, `exam-screen` | PASS; live graded exam NOT RUN |
| IDSS points and badges (never scoring) | DB section 20; unit `gamification.test.ts` | PASS |
| Support monitoring, daily summary, notes (D1 to D3) | DB sections 21 to 23; unit `support-indicators`, `teacher-notes` | PASS |
| Assignments and notices | DB section 24; unit `assignments.test.ts`; live probe of migration 030 (rolled back) | PASS |
| Web Push subscriptions and status | DB section 25; unit `push-status.test.ts` | PASS; delivery NOT RUN |
| Special gifts and Vitrina | DB section 26; unit `gifts.test.ts` | PASS |
| Director Command Center and settings | DB section 27; unit `director.test.ts` | PASS |
| IDSS print and CSV export (formula-safe, audited) | unit `idss-export.test.ts` | PASS |
| Security headers and nonce CSP | e2e `security-headers.spec.ts` | PASS |
| Layout P-14 (320 to 2560 px, public pages) | e2e `layout.spec.ts` | PASS |
| Accessibility WCAG 2.2 AA (public pages, three languages, two devices) | e2e `accessibility.spec.ts` (axe) | PASS; signed-in screens with fixtures PASS |

### B.6 Official catalogues: integrity and extraction
| Catalogue | SHA-256 (repository file) | Registry | Stored size | Status |
|---|---|---|---|---|
| B/H/S | `ba11dfbb0bca...ac3ad3e8` | identical, active | 1466891 = registry | PASS |
| Matematika | `450a10071ffc...67855149` | identical, active | 3009071 = registry | PASS |
| Njemački | `51a8d531227e...cfab89c05` | identical, active | 1578163 = registry | PASS |

- Hashes also match `config/canonical-facts.json` and `config/parser-profiles.json` (parser bound to the edition).
- Bucket `canon-documents`: private, PDF only, 50 MB limit, no storage policy for the API roles (PASS). One stale
  staging copy of the German catalogue remains (F-06).
- Reconciliation (live): Mathematics 200 questions with 200 keys; B/H/S 200 questions with keys plus 20 supplementary
  tasks without keys (documented); German 80 tasks with 200 scored item keys. No duplicate numbers or records. No key
  revision and no erratum yet (DEU-4.3.34 pending, F-12). PASS.
- Question crops: 500 public images bound to the catalogue SHA-256 in `public/catalogue/manifest.json`. Seven sampled
  across all subjects show the printed task only, no key (the renderer takes regions from the question sections; the
  keys are printed elsewhere). PASS on sample; the full set was not inspected one by one (F-11).

### B.7 Teacher approval gate
| Layer | Evidence | Status |
|---|---|---|
| Database constraint | `question_versions.review_id` NOT NULL, unique; `trust_status = 'trusted'` only | PASS |
| Direct reads as a student (live, rolled back) | 0 rows in `ingested_records`, `question_versions`, `answer_keys`, key revisions, reviews, chunks, blueprints | PASS |
| Practice and mock exams | functions read trusted versions only; key only after the answer or after the teacher's confirmation (DB 17, 18) | PASS |
| Search and AI | staff only (`canon.review`/`canon.publish`); index built from trusted content only (DB 12, 15) | PASS |
| Exports | staff only, learning facts, no keys | PASS |
| Human review of each question | 500 of 500 accepted under the Director's account: 492 carry the bulk tag "Skupno prihvatanje ... bez pojedinačnog pregleda" (PDL-016), 8 were accepted individually; none by a subject teacher | **FAIL against the directive, F-01** |

### B.8 Authentication, authorisation, database security
- Live catalogue: RLS on every public table; no write policy for `anon` or `authenticated` on any public table; no
  public function executable by `anon` or `authenticated`; every security definer function pins `search_path`. Now
  guarded by DB section 28. PASS.
- Live probes (rolled back) as `anon`: 0 rows in every sensitive table. As a student: own role to superadmin 0 rows;
  own staff bundle refused (42501); audit log write refused, erase 0 rows; Director functions with the Director's id
  refused (42501); other students' answers, support notes, teacher notes, audit log 0 rows. PASS.
- Accounts: 7 auth users, 7 profiles, none without profile; capability check includes account status; the app treats
  a user without an active profile as signed out; no sign-up route exists. Self sign-up through the public API would
  give no access, but the Auth setting itself is unverified (F-03).
- Secrets: none in tracked files, none in the full git history (only `.env.example` placeholders), none in the client
  bundle (only variable names inside user messages); `.env*` ignored except `.env.example`. PASS.
- Server actions take the actor from the session, never from form input (all 17 action modules). PASS.

### B.9 Migration safety
- All 34 migrations apply in order to an empty database with representative fixtures (`test:db`). PASS.
- 030 (already run by the Director): drops and re-adds `notifications_kind_check` with two more kinds and replaces one
  function. It widens the rule, deletes no data, takes a short lock on the small `notifications` table, and re-running
  it gives the same result. Live verification: both new kinds insert (rolled back). PASS.
- 034 was applied through the connector (no DROP) after a failing-then-passing test as `service_role`. PASS.
- No applied migration was edited after it ran; fixes were forward migrations (034). PASS.

### B.10 Notifications
- In-app notices for assignments and gifts: live after 030. PASS.
- Web Push: VAPID private key server-only; malformed values are reported, never thrown (fix of 2026-10-04, unit
  tests); gone subscriptions (404, 410) are removed; one tag per assignment or gift avoids duplicates; the payload
  carries no personal data apart from the assignment title written by the teacher. The Sistem tab reports
  configuration, not delivery (F-09). Delivery to a device: NOT RUN.

### B.11 Calculations and business rules
Scoring, pre-scoring by the effective key, allowed points, readiness (PDL-032), mastery, IDSS points (PDL-029) and
assignment states are computed in the database; the client sends answers only. Covered by DB sections 17, 18, 20,
21, 24 and unit tests (grading 6, support indicators 7, assignments 7, practice 4, gamification 3). PASS. A live
graded mock exam does not exist yet: INCONCLUSIVE until the teachers confirm blueprints.

### B.12 Performance (measured, phone profile: 390 px, 150 ms latency, 1.6 Mbit/s, CPU 4x slower)
| Page | FCP | LCP |
|---|---|---|
| Home | 1.9 s | 2.3 s |
| Sign-in | 1.4 s | 2.3 s |
| Game Hub (fixture) | 1.5 s | 2.3 s |
| Vitrina (fixture, 3D) | 1.1 s | 2.6 s |
Shared JavaScript about 175 KB compressed per page. Load and stress: NOT RUN (B.4).

### B.13 Responsive, visual, accessibility, privacy
- P-14 layout PASS at 320, 375, 768, 1024, 1366, 1920 and 2560 px (public pages). Signed-in screens checked at 1440
  and 390 px with fixtures. Real devices NOT RUN.
- Accessibility: axe WCAG 2.0/2.1/2.2 A and AA PASS on all public pages; two findings fixed earlier the same day
  (scroll tables keyboard reachable, badge contrast). Keyboard focus visible globally; in-app confirmation dialog
  traps focus and closes with Escape.
- Design system: tokens on `:root` in `globals.css` (IDSS palette P-11), one print frame (PDL-036), one dialog.
- Privacy: least privilege verified (B.8); support notes separated; exports audited; push payloads minimal; trial
  data inventory and clean start in `docs/PRODUCTION_READINESS.md` (PDL-038).

### B.14 Redundancy and hygiene
No unused dependency (depcheck) and no unreferenced source module. Nothing proposed for deletion: `CODE-PROTOTYPE/`,
`OSTALI-DOKUMENTI/` and `tools/` are reference and evidence material referenced by the discovery docs; removal would
lose provenance for no runtime gain. Only F-06 (one stale storage object) is proposed for removal, inside the clean
start.

## C. Findings

| ID | Severity | Confidence | Component | Finding | Evidence | Proposed remediation | Retest |
|---|---|---|---|---|---|---|---|
| F-01 | High (release gate) | Confirmed | Content integrity, teacher gate | 492 of 500 pupil-facing questions were accepted in bulk under the Director's account without per-item review; all 500 reviews carry the Director as reviewer | Live query of `question_versions` joined to `record_reviews` and `profiles`; PDL-016; SPRINT_04 open risk | Director chooses: (a) confirm PDL-016 as an explicit launch exception, recorded as a new decision, with teachers re-reviewing after launch; (b) code change: pupils see only individually reviewed questions until each bulk-accepted one is re-reviewed by its subject teacher; (c) postpone the launch until the teachers have reviewed | Re-run the B.7 query and DB sections 11, 17 |
| F-02 | Medium | Confirmed | CI | GitHub Actions runs only the project guard and the P-13 check; typecheck, lint, unit, DB, build and e2e run only locally. A merge to `main` will deploy once Vercel is connected | `.github/workflows/project-guard.yml` | Add a CI job running typecheck, lint, check:text, vitest, test:db (PostgreSQL 17 with pgvector), build and e2e on every PR | CI run green on a PR |
| F-03 | Medium | Unverified | Supabase Auth | Public sign-up, email confirmation and session settings cannot be read here; a self-registered user gets no access, but sign-up should be off (administrator-provisioned accounts only, mandate) | No tool access; 0 orphan auth users today | Director: Supabase, Authentication, Sign In / Providers: turn off "Allow new users to sign up"; report the setting | Director's screenshot or confirmation |
| F-04 | Medium | Unverified | Recovery | Backup and point-in-time recovery state unknown; the clean start deletes rows | No tool access | Before the clean start: a full database backup (dashboard backup if the plan provides one, otherwise `supabase db dump` by the Director) kept with the D-A archive | Backup file exists and its size is recorded |
| F-05 | Medium | Confirmed | Exam blueprints | B/H/S and Mathematics blueprints were confirmed with the Director's account (2026-10-03, 2026-10-04), not by the teachers | Live query of `exam_blueprint_reviews` | Director decides keep or treat as trial (open question in `PRODUCTION_READINESS.md`) | Re-query after the clean start |
| F-06 | Low | Confirmed | Storage | Stale `staging/` copy of the German catalogue in `canon-documents` | Live `storage.objects` listing | Remove during the clean start (Director-approved) | Listing shows 3 objects |
| F-07 | Low | Confirmed | Dev dependencies | 5 high advisories in the eslint toolchain (`braces`, `micromatch`, `fast-glob`); not in the production bundle | `npm audit`; production audit 0 | Track upstream `eslint-config-next`; the offered fix is a downgrade to 14.x, not applied | `npm audit --omit=dev` stays 0 |
| F-08 | Low | Confirmed | Search | No per-user rate limit on staff search with Gemini; bounded by key rotation and quota only | `retrieval/actions.ts` | Add a simple per-account limit if usage shows abuse; staff only today | Unit test of the limit |
| F-09 | Info | Confirmed | Push status | "Push obavijesti su podešene" means configured, not delivered | `director-screen.tsx`, `push/send.ts` | Keep wording; verify delivery with the first real assignment (post-deploy list) | Post-deploy check |
| F-10 | Info | Confirmed | Migration history | 024 recorded after 026; 030 recorded by hand after the Director ran it | `supabase_migrations.schema_migrations` | None; documented in `docs/schema-audit.md` | n/a |
| F-11 | Info | Sampled | Public crops | 500 question images are public by design (P-15); sample of 7 shows no key | `public/catalogue` | Optional: automated check that no crop region lies in a key section (`tools/question-images/verify.py` extension) | Script output |
| F-12 | Info | Confirmed | Errata | DEU-4.3.34 not yet recorded; teachers after launch (PDL-041 addendum) | `catalogue_errata` 0 rows | Teacher records it after launch | Query |

## D. Remediation plan (needs the Director's approval before any implementation)

| ID | Change | Files / subsystems | Regression risk | Verification | Time | Estimated ACA tokens* | Rollback |
|---|---|---|---|---|---|---|---|
| F-01 (b) | Mark bulk-accepted versions; practice and exam generation use only individually reviewed or re-reviewed questions; teacher "re-review" action in the review screen; DB tests | new forward migration 035 (flag derived from the PDL-016 note, functions `practice_next`, exam generation), `features/review`, i18n | Medium: pupils see far fewer questions until teachers re-review | DB tests for both states; live count per subject | 4 to 6 h | 400k to 700k | Forward migration restoring the previous functions |
| F-01 (a) | New decision record only | `DECISION_LOG.md` | None | n/a | 10 min | 10k | n/a |
| F-02 | CI quality job | `.github/workflows/quality.yml` | Low (CI only) | Green run on a PR | 1 to 2 h | 100k to 200k | Delete the workflow file |
| F-03 | Dashboard setting (Director) | Supabase Auth | None | Director confirmation | 5 min | 0 | Toggle back |
| F-04 | Backup before clean start (Director runs, ACA documents) | `docs/PRODUCTION_READINESS.md` | None | Backup file recorded | 30 min | 20k | n/a |
| F-05, F-06 | Part of the clean-start migration | clean-start migration (2026-10-05) | Low | Inventory recount | inside the clean start | inside the clean start | Restore from the F-04 backup |
| F-08 | Per-account search limit | `features/retrieval` | Low | Unit test | 1 h | 80k | Revert commit |

*Token estimates assume the current repository size, reading only the affected modules, one implementation pass and
one verification pass; they are estimates, not measurements.

## E. Release gate status
| Gate condition (directive section 21) | Status |
|---|---|
| Critical or high security defect | none found |
| Unauthorised access to protected records | none found (B.8) |
| Exposure of service-role or other critical secrets | none found (B.8) |
| Bypass of the teacher approval gate | technical bypass: none; human review: **F-01 open** |
| Incorrect or corrupted official catalogue data | none found (B.6) |
| Errors in scoring or key association | none found in tests and reconciliation (B.6, B.11) |
| Authentication or provisioning failures | none found; Auth settings unverified (F-03) |
| Unsafe migrations | none found (B.9) |
| Critical workflow regressions | none (B.3) |
| Backup and rollback plan | **unverified (F-04)**; Vercel instant rollback available once deployed |

Next step: the Director decides F-01 (a, b or c), confirms F-03, and approves the F-04 backup. The ACA then
re-runs this gate and reports again. The deploy still requires "kreni" (M-23).

## F. Addendum: Director decisions (2026-10-04, PDL-042)
| Finding | Decision | Gate status |
|---|---|---|
| F-01 | Option (a): PDL-016 confirmed as a launch exception; teachers re-review after launch | Resolved by recorded Director decision |
| F-03 | Public sign-up switched off earlier (Director's statement) | Accepted on the Director's statement |
| F-04 | Supabase free plan has no backups (Director, dashboard 2026-10-04); Director made an own `pg_dump` 17.11 copy of the 17.6 database on 2026-10-04 19:14: custom format, 1544 TOC entries, 3.26 MB, verified with `pg_restore --list`, kept outside the repository. Repeated right before the clean start | Resolved |
| F-05 | Teachers confirm after launch; Director confirmations removed in the clean start (ACA reading, step shown separately) | Resolved |

**Updated executive decision: CONDITIONAL, NOT APPROVED.** The blocking finding is resolved by decision and F-04 is
resolved (2026-10-04). What remains: the checks that cannot run from this environment (B.4), the clean start itself and
the Director's go (M-23). The ACA re-runs the gate the day of the clean start.
