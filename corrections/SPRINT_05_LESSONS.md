# Sprint 05 — Lessons Learned
Date: 2026-09-27 (open)

## Corrections Applied
1. `websearch_to_tsquery` joins words with AND, so natural questions found nothing; caught by the live check on real
   chunks, not by the fixture tests (single-word queries) → migration 010 (OR query with prefixes), then 011 (function
   words dropped, ranking by matched words). Retrieval changes are judged on a set of real questions against the live
   index before they are called done.

## Gotchas Discovered
- The local test database was created with `initdb` defaults (SQL_ASCII), so `translate()` worked on bytes and diacritic
  folding failed only locally; Supabase is UTF-8. `scripts/test-db.sh` now runs `initdb -E UTF8 --locale=C.UTF-8`.
- Piping `npm run build` into `head` ends the build early (SIGPIPE) and leaves no production build; the e2e web server
  then fails to start. Build output goes to a log file and is filtered afterwards.
- `ts_rank_cd` with length normalisation ranked short unrelated texts above the rule a question was about; counting
  matched content words first gives stable, explainable ranking for full-text search.

- Bulk acceptance (PDL-016) let extraction defects through that per-item review would have caught: footnote text
  inside six trusted questions surfaced only in the first live search (AMB-19). Search results are a cheap second
  review channel; bulk-accepted content needs a correction path before students see it.

## Commander Improvement Candidates
- ENGINEERING_RULES (search/RAG): every retrieval change is evaluated on a fixed list of real questions against the
  real index (expected top source per question), kept in the sprint document as evidence.
