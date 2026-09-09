#!/bin/sh
set -eu

# Build against the exact patched Debian source selected for the runtime binary.
nginx_version=$(dpkg-query -W -f='${source:Version}' nginx-core)
mkdir -p /tmp/njs-build /opt/njs
cd /tmp/njs-build
apt-get source "nginx=$nginx_version"
curl --fail --location --retry 3 \
    https://github.com/nginx/njs/archive/refs/tags/0.4.3.tar.gz -o njs.tar.gz
echo '463df8004ccbc4a7420c7fc501260ff9b273c69f4a8b6a21a39836c9d47f36d4  njs.tar.gz' | sha256sum -c -
tar -xzf njs.tar.gz
cd nginx-*/
./configure --with-compat --with-http_ssl_module \
    --add-dynamic-module=/tmp/njs-build/njs-0.4.3/nginx
make -j2 modules
cp objs/ngx_http_js_module.so /opt/njs/
printf '%s\n' "$nginx_version" > /opt/njs/nginx-source-version
dpkg --print-architecture > /opt/njs/architecture
printf '%s\n' 'load_module /usr/lib/nginx/modules/ngx_http_js_module.so;' \
    > /opt/njs/50-mod-http-js.conf
cp /opt/njs/ngx_http_js_module.so /usr/lib/nginx/modules/
cp /opt/njs/50-mod-http-js.conf /etc/nginx/modules-enabled/
nginx -t
