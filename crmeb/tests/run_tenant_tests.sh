#!/usr/bin/env bash
set -euo pipefail
test_root="$(cd "$(dirname "$0")" && pwd)"
php_bin="${TENANT_TEST_PHP:-php}"
mysql_bin="${TENANT_TEST_MYSQLD:-mysqld}"
scratch="$(mktemp -d "${TMPDIR:-/tmp}/lsit21-isolated.XXXXXX")"
mysql_pid=''
cleanup() {
    if [ -n "$mysql_pid" ]; then
        # This is the exact child started below, never a shared daemon.
        kill "$mysql_pid" 2>/dev/null || true
        wait "$mysql_pid" 2>/dev/null || true
    fi
    rm -rf "$scratch"
}
trap cleanup EXIT
mkdir "$scratch/db" "$scratch/cache"
export TENANT_TEST_PORT="${TENANT_TEST_PORT:-43368}"
export TENANT_TEST_DATABASE="lsit21_test_$(openssl rand -hex 6)"
export TENANT_TEST_CACHE="$scratch/cache"
export TENANT_TEST_ENTRY_CONFIG="$scratch/entries.json"
if [ "$TENANT_TEST_PORT" -le 1024 ] || [ "$TENANT_TEST_PORT" -eq 3306 ]; then exit 2; fi
"$mysql_bin" --no-defaults --initialize-insecure --datadir="$scratch/db" >"$scratch/init.log" 2>&1
"$mysql_bin" --no-defaults --datadir="$scratch/db" --bind-address=127.0.0.1 \
    --port="$TENANT_TEST_PORT" --socket="$scratch/mysql.sock" --pid-file="$scratch/mysql.pid" \
    --mysqlx=OFF --skip-log-bin --log-error="$scratch/mysql.log" >"$scratch/stdout.log" 2>&1 &
mysql_pid=$!
ready=0
for attempt in {1..100}; do
    if ! kill -0 "$mysql_pid" 2>/dev/null; then cat "$scratch/mysql.log"; exit 1; fi
    if "$php_bin" -r 'try { new PDO("mysql:unix_socket=" . $argv[1], "root", ""); } catch (Throwable $e) { exit(1); }' "$scratch/mysql.sock" 2>/dev/null; then ready=1; break; fi
    sleep 0.1
done
if [ "$ready" -ne 1 ]; then cat "$scratch/mysql.log"; exit 1; fi
if [ "${1:-}" = '--serve' ]; then
    echo 'Anonymous bootstrap serving is retired; use run_tenant_header_http.sh for isolated HTTP verification.' >&2
    exit 2
elif [ "$#" -gt 0 ]; then
    "$php_bin" "$test_root/$1"
else
    "$php_bin" "$test_root/user_auth_type_test.php"
    "$php_bin" "$test_root/tenant_credentials_test.php"
    "$php_bin" "$test_root/tenant_public_bootstrap_test.php"
    "$php_bin" "$test_root/admin_login_test.php"
fi
