#!/usr/bin/env bash
set -euo pipefail
test_root="$(cd "$(dirname "$0")" && pwd)"
php_bin="${TENANT_HEADER_PHP:-/opt/homebrew/opt/php@7.4/bin/php}"
fpm_bin="${TENANT_HEADER_FPM:-/opt/homebrew/opt/php@7.4/sbin/php-fpm}"
mysql_bin="${TENANT_HEADER_MYSQLD:-/opt/homebrew/opt/mysql@8.0/bin/mysqld}"
scratch="$(mktemp -d /tmp/lsit21-kf-cache.XXXXXX)"
pids=()
cleanup() {
    for pid in "${pids[@]-}"; do kill "$pid" 2>/dev/null || true; done
    for pid in "${pids[@]-}"; do wait "$pid" 2>/dev/null || true; done
    rm -rf "$scratch"
}
trap cleanup EXIT
export TENANT_HEADER_DATABASE="lsit30_test_$(openssl rand -hex 6)"
export TENANT_HEADER_MYSQL_PORT="${TENANT_HEADER_MYSQL_PORT:-47961}"
export TENANT_HEADER_HTTP_PORT="${TENANT_HEADER_HTTP_PORT:-47962}"
export TENANT_HEADER_REDIS_PORT="${TENANT_HEADER_REDIS_PORT:-47963}"
export TENANT_HEADER_NO_UNDERSCORE_PORT="${TENANT_HEADER_NO_UNDERSCORE_PORT:-47964}"
export TENANT_HEADER_SCRATCH="$scratch"
for port in "$TENANT_HEADER_MYSQL_PORT" "$TENANT_HEADER_HTTP_PORT" "$TENANT_HEADER_REDIS_PORT" "$TENANT_HEADER_NO_UNDERSCORE_PORT"; do
    if [ "$port" -le 1024 ] || lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null; then exit 2; fi
done
mkdir "$scratch/db" "$scratch/app" "$scratch/redis"
rsync -a --exclude=.env --exclude=runtime --exclude=tests --exclude=install.lock "$test_root/../" "$scratch/app/"
if [ "${KF_CACHE_BASELINE:-0}" = 1 ]; then
    for file in app/services/other/CacheServices.php app/dao/other/CacheDao.php; do
        git -C "$test_root" show "45087ac89aba19a6eade17840babf39bf125b78b:crmeb/$file" > "$scratch/app/$file"
    done
fi
"$mysql_bin" --no-defaults --initialize-insecure --datadir="$scratch/db" >"$scratch/mysql-init.log" 2>&1
"$mysql_bin" --no-defaults --datadir="$scratch/db" --bind-address=127.0.0.1 --port="$TENANT_HEADER_MYSQL_PORT" \
    --socket="$scratch/mysql.sock" --pid-file="$scratch/mysql.pid" --mysqlx=OFF --skip-log-bin \
    --sql-mode='' --log-error="$scratch/mysql.log" >"$scratch/mysql-stdout.log" 2>&1 &
pids+=("$!")
redis-server --bind 127.0.0.1 --port "$TENANT_HEADER_REDIS_PORT" --save '' --appendonly no --dir "$scratch/redis" >"$scratch/redis.log" 2>&1 &
pids+=("$!")
ready=0
for attempt in {1..100}; do
    if "$php_bin" -r 'try {new PDO("mysql:unix_socket=".$argv[1], "root", "");} catch(Throwable $e) {exit(1);}' "$scratch/mysql.sock" 2>/dev/null; then ready=1; break; fi
    sleep .1
done
if [ "$ready" -ne 1 ]; then cat "$scratch/mysql.log"; exit 1; fi
mysql --no-defaults -uroot --socket="$scratch/mysql.sock" -e "CREATE DATABASE $TENANT_HEADER_DATABASE CHARACTER SET utf8mb4"
mysql --no-defaults -uroot --socket="$scratch/mysql.sock" "$TENANT_HEADER_DATABASE" < "$scratch/app/public/install/crmeb.sql"
mysql --no-defaults -uroot --socket="$scratch/mysql.sock" "$TENANT_HEADER_DATABASE" < "$scratch/app/public/install/tenant_migration.sql"
mysql --no-defaults -uroot --socket="$scratch/mysql.sock" "$TENANT_HEADER_DATABASE" < "$scratch/app/upgrade/tenant_credentials.sql"
cat > "$scratch/app/.env" <<EOF
APP_DEBUG = false
[APP]
APP_KEY = isolated-header-test-only
[DATABASE]
HOSTNAME = 127.0.0.1
HOSTPORT = $TENANT_HEADER_MYSQL_PORT
DATABASE = $TENANT_HEADER_DATABASE
USERNAME = root
PASSWORD =
PREFIX = eb_
DEBUG = false
[CACHE]
DRIVER = redis
[REDIS]
REDIS_HOSTNAME = 127.0.0.1
PORT = $TENANT_HEADER_REDIS_PORT
REDIS_PASSWORD =
EOF
touch "$scratch/app/public/install.lock"
cat > "$scratch/fpm.conf" <<EOF
[global]
daemonize = no
error_log = $scratch/fpm.log
[test]
listen = $scratch/fpm.sock
pm = static
pm.max_children = 2
clear_env = no
chdir = $scratch/app/public
catch_workers_output = yes
EOF
: "${KF_NGINX:?set KF_NGINX to the nginx binary}"
: "${KF_NJS_MODULE:?set KF_NJS_MODULE to ngx_http_js_module.so}"
git -C "$test_root" show 8003def25d26c77f678aed8d86716126aed09fcc:docker/tenant-headers.js > "$scratch/tenant-headers.js"
git -C "$test_root" show 8003def25d26c77f678aed8d86716126aed09fcc:docker/nginx.conf > "$scratch/server.conf"
sed -i '' -e "s|/etc/nginx/tenant-headers.js|$scratch/tenant-headers.js|" \
    -e "s|listen 80 default_server;|listen 127.0.0.1:$TENANT_HEADER_HTTP_PORT;|" \
    -e "s|/var/www/crmeb/public|$scratch/app/public|g" \
    -e "s|/var/log/nginx/|$scratch/|g" \
    -e 's|include fastcgi_params;|include /opt/homebrew/etc/nginx/fastcgi_params;|' \
    -e "s|fastcgi_pass 127.0.0.1:9000;|fastcgi_pass unix:$scratch/fpm.sock;|" "$scratch/server.conf"
cat > "$scratch/nginx.conf" <<EOF
load_module $KF_NJS_MODULE;
daemon off;
master_process off;
error_log $scratch/nginx-error.log;
pid $scratch/nginx.pid;
events { worker_connections 64; }
http {
client_body_temp_path $scratch/client-body;
fastcgi_temp_path $scratch/fastcgi-temp;
include $scratch/server.conf;
}
EOF
"$php_bin" "$test_root/tenant_header_http.php" seed
"$fpm_bin" -y "$scratch/fpm.conf" >"$scratch/fpm-stdout.log" 2>&1 &
pids+=("$!")
"$KF_NGINX" -p "$scratch/" -c "$scratch/nginx.conf" >"$scratch/nginx-stdout.log" 2>&1 &
pids+=("$!")
ready=0
for attempt in {1..100}; do
    if [ -S "$scratch/fpm.sock" ] && curl -fsS "http://127.0.0.1:$TENANT_HEADER_HTTP_PORT/api/version" > /dev/null; then ready=1; break; fi
    sleep .1
done
if [ "$ready" -ne 1 ]; then cat "$scratch/fpm.log" "$scratch/nginx-error.log"; exit 1; fi
"$php_bin" "$test_root/kf_adv_cache_mysql.php"
cleanup
trap - EXIT
echo 'PASS services stopped and isolated data removed'
