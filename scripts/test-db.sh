#!/usr/bin/env bash
# Run migrations/*.sql against a throw-away local PostgreSQL with a Supabase stub, then the
# RLS/integrity tests. Usage: scripts/test-db.sh   (needs PostgreSQL 15+ server binaries)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA_DIR="$(mktemp -d)"
PORT="${DB_TEST_PORT:-54329}"
RUN_AS=()
if [ "$(id -u)" = "0" ]; then chown -R postgres "$DATA_DIR"; RUN_AS=(runuser -u postgres --); fi
cleanup() { "${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA_DIR" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DATA_DIR"; }
trap cleanup EXIT
"${RUN_AS[@]}" "$PG_BIN/initdb" -D "$DATA_DIR" -A trust -U postgres >/dev/null
"${RUN_AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA_DIR" -o "-p $PORT -k /tmp -c listen_addresses=''" -w start >/dev/null
PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -f "$ROOT/tests/db/supabase-stub.sql"
for migration in "$ROOT"/migrations/*.sql; do
  echo "applying $(basename "$migration")"
  "${PSQL[@]}" -f "$migration"
done
"${PSQL[@]}" -f "$ROOT/tests/db/rls.test.sql" 2>&1 | sed -n 's/.*NOTICE:  //p'
echo "database tests passed"
