# Forensic audit, 18.10.2026

Project: IDSS - External Graduate Examination. Requested by the Director before the project is declared final
("izvrši forenzički audit cijelog projekta, svake linije koda i svake opcije/funkcije").
Scope: every source file in `src/` (219 files, 17 485 lines), `public/sw.js`, all 36 migrations, scripts, tools,
CI workflows, configuration, and the live Supabase project `dezevstfmfliyasdeflj`.
Base: `main` at 3be3189. The audit is read-only: nothing in the app, the database or storage was changed.
Earlier audit for comparison: `docs/audit/PRE_DEPLOYMENT_AUDIT_2026-10-04.md`.

## 1. Verdict

The code is in good shape. No critical finding. Authorisation holds at three layers (page or route guard,
Server Action capability check, database function re-check with subject scope). The live database matches the
repository exactly. Every automated check passes.

The project is **not ready to go live yet**, for one process reason and four technical ones:

1. **DB-4 (High, process):** the 08.10 launch did not happen. The clean start (PDL-038) has not been run, and
   trial data is still in the live database.
2. **DEP-1 (High):** next 16.3.6 has a published advisory. Upgrade to 16.4.2 before the deploy.
3. **ACC-1 (Medium):** a failed account creation can leave a half-created account behind.
4. **SEC-3 (Medium):** a password reset does not sign out sessions that are already open.
5. **DB-1 (Medium):** API roles keep the default TRUNCATE right on the tables (defence in depth).

## 2. Method

| Phase | What | Result |
|---|---|---|
| A | Automated baseline: typecheck, lint, text style (P-13), 186 unit tests, DB tests on throw-away PostgreSQL, production build, 86 e2e tests (desktop and mobile, axe, layout P-14, CSP), npm audit | all green; npm audit see DEP-1 |
| B | Live database: schema built locally from `migrations/*.sql`, then compared with live on tables, columns, constraints, policies, triggers, grants, indexes, and the md5 of every function body; security and performance advisors; row counts; storage | identical (DB-2); findings DB-1, DB-3, DB-4 |
| C | Line-by-line review: proxy, CSP, env, session and cookies, logger, permissions, validation, all 17 action modules (42 Server Actions), 8 route handlers, 33 pages and layouts, repositories, AI module, service worker, scripts, tools, CI | findings below |
| D | Function matrix (section 4) | every entry point guarded |

## 3. Findings by severity

### High

**DB-4. Launch not done, trial data still live (process)**
- There has been no activity since 04.10.2026 16:33.
- The live database still holds 7 profiles (including the trial student), 28 practice answers, 1 mock exam,
  1 assignment, 1 gift, 1 notification, 713 audit rows, 6 security events and 2 blueprint reviews.
- Storage holds 4 objects, one of them an abandoned staging upload.

Remedy: when the Director gives the new launch date, follow `docs/PRODUCTION_READINESS.md`:
1. backup;
2. export the test-phase audit to the archive (D-A);
3. one audited removal;
4. then "kreni".

**DEP-1. Dependency advisories**

| Package | Advisory | Reachable? |
|---|---|---|
| `next` 16.3.6 | leak in "use cache" / draft mode | No: the app uses neither |
| `sharp` | librsvg CVE | No: `next/image` is not used |
| `source-map-js` | build time only | No |
| `eslint-config-next` chain | development only | No |

Remedy: raise `next` and `eslint-config-next` to 16.4.2 and re-run the full check set. Even though none of these
is exploitable today, a production deploy should not ship with a known advisory.

### Medium

**ACC-1. Account creation cleanup can fail and leave an orphan**
- File: `src/features/accounts/actions.ts:75-91`.
- What happens: when `insertPerson` (or a later step) fails after `insertProfile` succeeded, the action calls
  `auth.admin.deleteUser`. That delete fails because `profiles.user_id` references `auth.users` with
  ON DELETE RESTRICT.
- Result: an auth user and a profile remain without a person row. A student account like this cannot practise.
  The screen says UNAVAILABLE, and a retry answers USERNAME_TAKEN.
- Remedy: delete the person and profile rows before the auth user in the cleanup path, or move profile, person
  and bundle creation into one service-role database function, so they live in one transaction.

**SEC-3. Password reset does not end existing sessions**
- Files: `src/features/accounts/actions.ts:202` and `src/features/account/actions.ts:58`.
- What happens: these use `updateUserById({ password })`. Refresh tokens that were already issued stay valid
  until they expire (cookie 12 h).
- Why it matters: if a password was reset because it leaked, the other person stays signed in.
- Already covered: a status change (suspend, block) is safe, because the status is checked on every request and
  Auth bans the user.
- Remedy: after a reset by the Superadmin, sign out the target's sessions globally (Auth admin sign-out). After
  the user changes their own password, sign out the other sessions.

**DB-1. Default write rights of the API roles**
- `anon` and `authenticated` hold INSERT/UPDATE/DELETE/TRUNCATE on all 54 public tables (Supabase default).
- RLS blocks DML, because there are no write policies.
- TRUNCATE ignores RLS and row triggers, and the append-only tables (`audit_logs`, `security_events`,
  `retrieval_audit_logs`, support and teacher notes) have no TRUNCATE guard.
- PostgREST offers no TRUNCATE, so this is not reachable today. It is defence in depth.
- Remedy: migration 037:
  1. `revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated`;
  2. a `before truncate` statement trigger with `reject_audit_mutation` on the append-only tables;
  3. DB tests;
  4. advisor run.

**CI-1. Keepalive workflow can fail silently**
- File: `.github/workflows/keepalive.yml`.
- `curl` has no `--fail`, so the job stays green on 401 or 5xx.
- `GET /rest/v1/` (the OpenAPI root) may not count as database activity for the free-plan pause.
- The secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` must exist in the repository settings.
- Remedy: `curl -fsS` against a real lightweight read, for example `GET /rest/v1/subjects?select=id&limit=1`.
  That read returns `[]` under RLS but does query the database.

**CI-2. CI checks only the project guard and the text style**
- File: `.github/workflows/project-guard.yml`.
- CI does not run typecheck, lint, unit tests, DB tests or the build. A change made outside a verified session
  (for example in the GitHub web editor, as with `keepalive.yml`) reaches `main` unchecked.
- The workflows also have no `permissions:` block, so they get the default token rights.
- Remedy: add a `checks` job (`npm ci`, typecheck, lint, `npm test`, `scripts/test-db.sh` with a PostgreSQL
  service, build) and `permissions: contents: read`.

### Low and Low-Medium

**SEC-4. Push endpoint accepts any https URL (Low-Medium)**
- File: `src/lib/validation/schemas.ts`, `PushSubscriptionSchema`.
- A signed-in user can register `https://any-host/` as their push endpoint. The server later sends an encrypted
  POST there (a blind outbound request to a host the attacker chose).
- Remedy: allowlist the push service hosts: `fcm.googleapis.com`, `*.push.services.mozilla.com`,
  `*.notify.windows.com`, `web.push.apple.com`.

**EXP-1. Two exports are not audited (Low-Medium)**
- Not audited: `/app/zadaci/[id]/izvoz` (names students, marked confidential) and `/app/pracenje/analiza/izvoz`.
- The other three exports do write an audit row.
- Remedy: `insertAuditLog` with `assignment.exported` and `support.analysis_exported`.

**ACC-2. Status change order (Low)**
- File: `src/features/accounts/actions.ts:~110-120`.
- The database status is written before the Auth ban. If the ban call fails, the status has changed but Auth has
  not banned the user, and no audit row is written.
- The app still blocks the account through the status check.
- Remedy: write the audit row in both cases, or ban first.

**SEC-1. X-Forwarded-For (Low)**
- `clientIpFrom` trusts the first entry. That is correct on Vercel, which overwrites the header.
- On any other host the per-IP rate limit could be spoofed. The per-username limit holds either way.
- Remedy: document "Vercel only", or read `x-real-ip` / the platform header.

**SEC-2. Lockout of a known username (Low, accepted trade-off)**
- Five failed attempts in 15 minutes lock that username for 15 minutes, so anyone who knows the username can
  lock the account.
- Remedy: document it in the Superadmin guide (unlock by waiting; the reset is unaffected).

**SW-1. Service worker URL check (Low, hardening)**
- File: `public/sw.js:18`.
- `url.startsWith("/")` also accepts `//other-host`. Push payloads come only from this server (VAPID), so this
  cannot be exploited.
- Remedy: check `!url.startsWith("//")`, or compare `new URL(url, origin).origin` with the own origin.

### Info

| ID | Finding |
|---|---|
| DB-2 | 116 of 116 functions are logically identical to the repository. 8 differ only in CRLF line ends (applied from the Windows SQL editor) and 16 only in comments or whitespace. Optional: re-apply them with LF for byte-exact parity. |
| DB-3 | 101 unused indexes. This is expected at trial-data size; re-check after a month of real use. Security advisor: only the Auth leaked-password WARN, already covered app-side (PDL-030). |
| PUSH-1 | `push_subscribe` moves an existing endpoint to the calling account (intended for shared browsers). The endpoint is a secret URL, so this is not a takeover path. |
| CODE-1 | Dead exports: `QUESTION_TEXT_MAX_LENGTH`, `SPLASH_PALETTE_PATH`, `LoginInput`, `CanonRegisterInput`, `CanonicalRuleFact`. A doc comment sits on the wrong declaration at `schemas.ts:279`. |
| BUILD-1 | `npm run build` without `.env.local` logs ConfigurationError while it pre-renders. The build still succeeds and production has the environment, so there is nothing to fix. |

## 4. Function matrix

**Server Actions (42).** Every action:
1. authenticates with `getCurrentAccount`;
2. authorises with `lib/permissions`;
3. validates with Zod or a strict pattern;
4. calls a service-role database function that re-checks the capability and the subject scope against the
   record's own subject and writes the audit row in the same transaction.

Failed attempts are audited (`auditIfFailed`), and every audit action name passes the database check.

| Module | Actions | Capability | DB re-check |
|---|---|---|---|
| authentication | loginAction, logoutAction | none (rate limited, security events) | Auth |
| account | changeOwnPasswordAction | own account | Auth, HIBP check |
| accounts | createAccountAction, changeAccountStatusAction, changeBundleAction, resetPasswordAction | accounts.manage, reset_password (Superadmin) | app-side; ACC-1, ACC-2, SEC-3 |
| canon | prepareCanonUploadAction, registerCanonVersionAction, transitionCanonVersionAction | canon.publish | register/activate/set_canon_version_status |
| ingestion | runIngestionAction | canon.publish | record_ingestion_job |
| knowledge | loadCanonicalFactsAction, decideRuleReviewAction | canon.publish; canon.review (subject) | load_canonical_facts, decide_rule_review |
| review | decideRecordAction, recordErratumAction, withdrawErratumAction, openFollowUpAction, resolveFollowUpAction | canon.review (subject) | subject-scoped functions |
| retrieval | searchCanonAction, buildIndexAction, buildSemanticIndexAction | canon.review/publish | retrieve_canon*, rebuild, store_chunk_embeddings |
| practice | submitPracticeAnswerAction | practice.participate | practice_submit (own person) |
| exams | requestExamAction, beginExamAction, saveExamAction, submitExamAction | practice.participate | mock_exam_* (own person, deadline + 30 s) |
| grading | loadBlueprintAction, reviewBlueprintAction, approveSetAction, discardSetAction, saveGradesAction, confirmGradesAction, reviewPracticeAnswerAction, sendTestAction | canon.publish; canon.review / exams.grade (subject) | exam's own subject |
| assignments | createAssignmentAction, withdrawAssignmentAction | assignments.manage (subject) | assignment_create/withdraw |
| support | addSupportNoteAction, addTeacherNoteAction | support_notes.read_write; teacher_notes.read_write (subject) | support_note_add, teacher_note_add |
| gifts | giveGiftAction, openGiftAction | subject teacher; practice.participate (owner) | gift_give, gift_open |
| push | savePushSubscriptionAction, removePushSubscriptionAction | active account | push_subscribe/unsubscribe (SEC-4) |
| notifications | markNotificationsReadAction | active account | notifications_mark_read (own rows) |
| settings | saveSplashPaletteAction, saveAppSettingAction | settings.manage | set_splash_palette, set_setting |

**Route handlers (8)**

| Route | Guard | Audit |
|---|---|---|
| `/app/kanon/preuzmi/[versionId]` | canon view, RLS lookup, signed URL valid for 60 s | yes |
| `/app/pregled/izvor/[versionId]` | canon.publish or canon.review for the subject; SHA-256 re-checked | by design no (public catalogue) |
| `/app/pracenje/izvoz` | students.view_progress and reports.export | yes |
| `/app/pracenje/dan/izvoz` | same | yes |
| `/app/pracenje/analiza/izvoz` | same, aggregates only | **no (EXP-1)** |
| `/app/zadaci/[id]/izvoz` | assignments.manage and reports.export | **no (EXP-1)** |
| `/app/direktor/izvoz` | analytics.view_institution and reports.export, plus audit.view for the log | yes |
| `/splash/palette` | public by design, no personal data | n/a |

**Pages and layouts (33).** All 26 pages under `/app` call `requireAccount` and the matching capability check, and return
`notFound()` for records outside the user's scope. The 6 public pages (home, login, 4 legal pages) and the root
layout contain no data. UI hiding is never the only barrier.

**Database functions (116).**
- Checked live: no function that takes `p_actor` is executable by `anon` or `authenticated`.
- `authenticated` may run only 5 helpers: `has_capability`, `current_account_role`, `fold_text`, `search_query`
  and `search_terms`.
- Every table has RLS.
- The audit tables are append-only for UPDATE and DELETE (see DB-1 for TRUNCATE).

**Other checks that passed**
- **Browser output:** the nonce CSP holds; `dangerouslySetInnerHTML` appears once, with static repository JSON;
  there is no `eval`.
- **Cookies:** httpOnly, SameSite=strict, 12 h.
- **Secrets and logs:** Gemini keys travel in a header, never in a URL or a log; CSV cells are safe against
  formula injection.
- **Uploads:** canon uploads are verified on the server (magic bytes, size, SHA-256, duplicates); staging objects
  are always removed.
- **Bootstrap script:** refuses a second Superadmin; the password is never stored.

## 5. Remediation plan (needs the Director's approval)

| Step | Findings | Change | Risk |
|---|---|---|---|
| 1 | DEP-1 | next and eslint-config-next 16.4.2, full check set | low |
| 2 | ACC-1, ACC-2 | cleanup order in createAccountAction; audit row on a failed ban; unit and e2e test | low |
| 3 | SEC-3 | global sign-out after a reset and after the user's own password change | low |
| 4 | SEC-4, SW-1 | push host allowlist, service worker origin check, tests | low |
| 5 | EXP-1 | audit rows for the two exports | very low |
| 6 | DB-1 | migration 037 (revoke, truncate guard), DB tests, advisor | low; it is a migration, so the Director applies it |
| 7 | CI-1, CI-2 | keepalive `--fail` and a real read; CI checks job; permissions | none for the app |
| 8 | CODE-1, DB-2 | remove dead exports; optional LF re-apply | none |
| 9 | DB-4 | clean start on the new launch date, then "kreni" | per PDL-038 |

Steps 1 to 5 and 7 to 8 fit in one pull request. Step 6 is a separate migration. Step 9 stays the very last
step before the deploy.

## 6. Remediation status (approved by the Director, 18.10.2026)

| Finding | Status | Change | Evidence |
|---|---|---|---|
| DEP-1 | fixed | next and eslint-config-next 16.4.2; source-map-js updated; `npm audit --omit=dev`: 0 vulnerabilities. The remaining dev-only advisories (eslint chain) need a breaking `--force` and never reach the app. | npm audit |
| ACC-1 | fixed | `removeHalfCreatedAccount`: person, then profile, then the auth user; the first error is logged | unit test (order, stop on failure) |
| ACC-2 | fixed | a failed Auth ban restores the earlier status before the failure is reported (and audited as `account.status_change_failed`) | typecheck, code review |
| SEC-3 | fixed | reset by the Superadmin: global sign-out of the target (`sessions_revoked` in the audit row); own change: all other sessions signed out (`other_sessions_revoked`) | unit test |
| SEC-4 | fixed | `PUSH_SERVICE_HOSTS` allowlist (FCM, Mozilla, Windows, Apple); host, port and credentials checked | unit tests (accepted and refused addresses) |
| SW-1 | fixed | `sameOriginPath` in `public/sw.js`: only paths of this origin, else `/app` | e2e green |
| EXP-1 | fixed | `assignment.exported` and `support.analysis_exported` audit rows | typecheck, build |
| DB-1 | written, **awaits the Director** | `migrations/037_api_role_write_grants.sql`: API roles read only (also for tables created later); TRUNCATE refused on all 34 append-only and frozen tables; clean start procedure updated | DB tests: 4 new assertions, existing ones adapted (writes are now refused instead of silently ignored) |
| CI-1 | fixed | keepalive: `--fail`, retries, a real read of `subjects`, secrets as environment variables, missing secrets fail the run | workflow |
| CI-2 | fixed | new `checks.yml` (typecheck, lint, text style, unit, DB tests, build); `permissions: contents: read` on every workflow | first run on this pull request |
| CODE-1 | fixed | dead exports removed; doc comment moved to `SupportNoteSchema` | typecheck, lint |
| DB-2 | left as is | optional LF re-apply not needed: function logic is identical | section 3 |
| SEC-1, SEC-2 | documented | accepted (Vercel overwrites X-Forwarded-For; lockout trade-off) | section 3 |
| DB-4 | open | clean start on the new launch date, then "kreni" | PDL-038 |

Checks after the remediation: typecheck, lint, check:text (105 files), 203 unit tests (31 files), DB tests, build
(33 pages) and 86 e2e tests: all green.
