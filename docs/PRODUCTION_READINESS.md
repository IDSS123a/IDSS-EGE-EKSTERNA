# Production readiness: clean start (Director's standing order)

Status: **standing order, 2026-10-03 (PDL-038)**. "Prije produkcije sistem mora biti očišćen od svih probnih
testiranja i unosa. Sve mora biti čisto i spremno za prvo korištenje."

Before the first real use (production deploy, M-23) the live project holds only what the school needs to start: the
canon (catalogues, reviewed records, rules, blueprints, errata confirmed by teachers), the real staff accounts and
the configuration. Every trial account and everything produced while testing is removed or, where the law of the
system forbids deletion (append-only audit), handled as the Director decides below.

## 0. Status: clean start DONE (2026-10-18)
Backup by the Director (pg_dump, 3.29 MB, kept outside the repository). The clean-start script ran in the Supabase SQL
editor in one transaction; verified live by the ACA: 6 staff accounts and 6 Auth users remain, 0 trial rows (answers,
reviews, mock exams, sends, assignments, gifts, notifications, blueprint confirmations), audit log, security events and
retrieval audit emptied except the one `system.clean_start` row with the removed counts (713 audit rows, 28 answers,
18 exam items ...); canon intact (500 questions, 600 keys, 20 rules, 3 blueprints, 6 follow-ups, 514 chunks and
embeddings); all 34 row guards and 34 truncate guards enabled; security advisor: only the known Auth WARN.
The SQL editor showed an error after the commit (a temp table no longer existed); the live check is what counts.
The stale staging upload was removed by the Director in the dashboard (verified: only the 3 catalogue sources remain).

**Deployed 2026-10-18:** Vercel team idsssarajevo, project `idss-ege-eksterna`, https://idss-ege-eksterna.vercel.app
(deployment dpl_ECw4JvEVKdWA9jXQMS9JhQEvBtsv, READY, from main e8c73a5). Verified by the ACA through the Vercel tools:
`/prijava` 200 with the nonce CSP (new nonce per request), HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy,
Permissions-Policy, COOP; `/app` signed out lands on the login page; `/splash/palette` reads the database; all 16
environment variables set (Supabase 3, Gemini 10, VAPID 3); no runtime errors. Functions run in iad1 (US East) while
Supabase is in eu-central-1: setting the function region to fra1 (Frankfurt) is recommended.
Open: the signed-in checks below need the Director's own sign-in.

## 1. Inventory of trial data (live, 2026-10-03)
| What | Live now | Action before production |
|---|---|---|
| Trial student account `a.b.` (Auth user, profile, person) | 1 | remove the account and its person |
| Practice answers of the trial student | 28 | remove (with the account) |
| Teacher reviews of those answers | 7 | remove (with the answers) |
| IDSS points and badges | derived, not stored | nothing (they follow the answers) |
| Trial assignment "03.10.26" (B/H/S, given by the Director) with its questions and recipients | 1 (2026-10-04) | remove |
| Trial gift from Nizama Memija to a.b. and its opening | 1 + 1 (2026-10-04) | remove |
| Mock exams, notifications, support notes, teacher notes, push subscriptions | 0 each (2026-10-04) | check again; remove trial rows |
| Exam blueprints (Math, B/H/S, German) | 3 | **keep** (real data, waiting for the teachers' confirmation) |
| Blueprint confirmations made with the Director's account (B/H/S 2026-10-03, Mathematics 2026-10-04) | 2 | remove as trial (PDL-042 F-05); shown as a separate step in the clean-start script |
| Audit log | 704 rows (2026-10-04) | D-A decided: export to the school archive, then one audited removal |
| Security events (failed logins during tests) | 6 | D-A decided (same procedure) |
| Retrieval audit of test searches | 13 | D-A decided (same procedure) |
| Stale staging copy of the German catalogue in storage `canon-documents/staging/` (audit F-06) | 1 | remove through the storage API (not SQL) |
| Staff accounts and their passwords | 6 | keep the accounts; every staff member sets a new password at first real use |

The inventory is re-run right before the cleanup; anything created after this date is added.

## 2. How the cleanup runs (M-4, M-23)
Timing: the last step before the production deploy, after all testing is finished (Director, 2026-10-03).

0. Backup first (audit F-04): the Supabase plan is free and has no backups, so the Director makes an own `pg_dump`
   file (README, "Rezervna kopija baze"), kept with the D-A archive. First copy verified 2026-10-04 (3.26 MB,
   1544 entries); the same three PowerShell commands are repeated right before the cleanup.
1. The ACA prepares one reviewed cleanup migration (`migrations/9xx_production_clean_start.sql`) that removes exactly
   the rows listed in the inventory by their trial account, never by date or pattern alone, inside one transaction,
   and prints the counts before and after.
2. The Director reviews it and runs it in the Supabase SQL editor (it deletes, so it never runs through the connector).
3. The ACA verifies: counts are zero, canon and staff are intact, security advisor clean, DB tests and e2e green.
4. Only then the production deploy (M-23).

## 3. Decision D-A (decided by the Director, 2026-10-03)
The Director chose the first option: export, then one audited removal. **When:** at the very end, right before the
production deploy, because testing continues until then. Not earlier.

- **D-A Audit history of the test phase.** The audit log, security events and retrieval audit are append-only; the
  database refuses to change them. Proposal: export the test-phase rows to a signed file for the school archive, then
  remove them once with a dedicated, audited procedure that briefly lifts the append-only guard and records its own
  run (one row: who, when, how many). Alternative: keep them as the honest history of the setup phase.
- Since migration 037 (forensic audit 2026-10-18, DB-1) the append-only and frozen tables also refuse TRUNCATE
  (`<table>_no_truncate` statement triggers). The cleanup migration removes rows with DELETE while it lifts the row
  guards (`<table>_append_only`, `*_frozen`); it never uses TRUNCATE, and it restores every guard before it ends.

## 4. Launch day (PDL-041: Vercel team `idsssarajevo`, target 2026-10-08, PDL-043)
Order: clean start the day before (section 2), then the Director's explicit go (M-23), then the import on Vercel by the
Director (README, "Objava na Vercel"), then this verification by the ACA on the production address.

### Post-deploy verification (Commander DONE_CHECKLIST)
- [ ] The production address loads the home page and the splash leaves (not a Vercel error page).
- [ ] Security headers present: nonce-based CSP that changes per request, no CSP violations in the console.
- [ ] Sign-in with a staff account works; a wrong password shows the friendly message and is counted.
- [ ] Core flows on the production address, each with zero uncaught console errors:
  - [ ] staff home links per role; Direktorski pregled, all six tabs, Sistem shows notices on and push configured;
  - [ ] a subject teacher opens Pregled pitanja and Ocjenjivanje;
  - [ ] a student opens the Game Hub and a practice question (with the first real student account; no trial account
        is created after the clean start);
  - [ ] the IDSS confirmation dialog appears on a confirm action and Odustani leaves everything unchanged (nothing
        is confirmed in production for the check).
- [ ] Every environment variable is set in Vercel (Settings, Environment Variables): a missing one shows the error
      page, not a code bug. Sistem tab names a malformed VAPID value.
- [ ] Web Push: confirmed with the first real assignment a teacher gives (no test assignment in production).
- [ ] Supabase security advisor: only the known Auth leaked-password WARN (mitigated in the app, PDL-030).
- [ ] Inventory of section 1 re-counted: zero trial rows.
