#!/usr/bin/env bash
# Valida as migrations num Postgres local (>= 15) sem precisar do Supabase.
# Uso: PGHOST=/tmp PGPORT=5432 ./supabase/tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")"
DB=beach_test
psql -U postgres -qc "drop database if exists $DB" -c "create database $DB"
psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f 00_stub_supabase.sql
for f in ../migrations/*.sql; do echo "== $f"; psql -U postgres -d $DB -q -1 -v ON_ERROR_STOP=1 -f "$f"; done
psql -U postgres -d $DB -q -v ON_ERROR_STOP=1 -f 01_seed_teste.sql
psql -U authenticator -d $DB -f 02_rls_regras.sql | tee /tmp/beach_rls.out
if grep -q "FALHOU" /tmp/beach_rls.out; then echo "Há testes falhando"; exit 1; fi
echo "Tudo certo."
