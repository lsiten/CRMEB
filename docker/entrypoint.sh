#!/bin/sh
set -eu
cd /var/www/crmeb
mkdir -p /var/lib/crmeb runtime public/uploads backup
# Installation writes through these links into the persistent state volume.
[ -f /var/lib/crmeb/.env ] || touch /var/lib/crmeb/.env
[ -f /var/lib/crmeb/.constant ] || printf '<?php\n' > /var/lib/crmeb/.constant
ln -sfn /var/lib/crmeb/.env .env
ln -sfn /var/lib/crmeb/.constant .constant
ln -sfn /var/lib/crmeb/install.lock public/install.lock
chown -R www-data:www-data /var/lib/crmeb
chown www-data:www-data runtime public/uploads backup
exec "$@"
