# Production readiness: clean start (Director's standing order)

Status: **standing order, 2026-10-03 (PDL-038)**. "Prije produkcije sistem mora biti očišćen od svih probnih
testiranja i unosa. Sve mora biti čisto i spremno za prvo korištenje."

Before the first real use (production deploy, M-23) the live project holds only what the school needs to start: the
canon (catalogues, reviewed records, rules, blueprints, errata confirmed by teachers), the real staff accounts and
the configuration. Every trial account and everything produced while testing is removed or, where the law of the
system forbids deletion (append-only audit), handled as the Director decides below.

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
| Blueprint confirmations made with the Director's account (B/H/S 2026-10-03, Mathematics 2026-10-04) | 2 | **open question to the Director**: keep (mock exams open at launch for B/H/S and Mathematics) or treat as trial and remove (teachers confirm after launch, PDL-041 L4 addendum) |
| Audit log | 704 rows (2026-10-04) | D-A decided: export to the school archive, then one audited removal |
| Security events (failed logins during tests) | 6 | D-A decided (same procedure) |
| Retrieval audit of test searches | 13 | D-A decided (same procedure) |
| Staff accounts and their passwords | 6 | keep the accounts; every staff member sets a new password at first real use |

The inventory is re-run right before the cleanup; anything created after this date is added.

## 2. How the cleanup runs (M-4, M-23)
Timing: the last step before the production deploy, after all testing is finished (Director, 2026-10-03).

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
