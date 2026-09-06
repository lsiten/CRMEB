#!/usr/bin/env bash
set -euo pipefail
image=${1:?image required}
container=crmeb-build-smoke
trap 'docker logs "$container"; docker rm -f "$container" >/dev/null' EXIT
docker run --rm --entrypoint sh "$image" -ec '
  test ! -e .env
  test ! -e .constant
  test ! -e public/install.lock
  test -s public/install/crmeb.sql
  test -s public/admin/index.html
  php -r '\''require "vendor/autoload.php"; foreach (["pdo_mysql", "mysqli", "gd", "redis", "bcmath", "zip", "mbstring", "pcntl", "sockets"] as $ext) { if (!extension_loaded($ext)) { exit(1); } }'\''
'
docker run -d --name "$container" -p 127.0.0.1:18080:80 "$image"
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:18080/healthz; then break; fi
  sleep 2
done
curl --fail --silent http://127.0.0.1:18080/healthz
curl --fail --silent http://127.0.0.1:18080/admin/ >/dev/null
curl --fail --silent http://127.0.0.1:18080/install/index.php | grep -q CRMEB
docker exec "$container" sh -ec '
  test -L .env && test -L .constant && test -L public/install.lock
  test ! -e public/install.lock
  test -w /var/lib/crmeb/.env
'
