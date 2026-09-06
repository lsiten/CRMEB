#!/bin/sh
set -eu
while [ ! -f /var/www/crmeb/public/install.lock ]; do
    sleep 5
done
exec "$@"
