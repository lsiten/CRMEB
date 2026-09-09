FROM debian:bullseye-slim AS njs-builder
RUN printf '%s\n' \
      'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/20260901T000000Z/ bullseye main' \
      'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/20260901T000000Z/ bullseye-security main' \
      'deb-src [check-valid-until=no] http://snapshot.debian.org/archive/debian/20260901T000000Z/ bullseye main' \
      'deb-src [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/20260901T000000Z/ bullseye-security main' \
      > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nginx-core ca-certificates curl \
       build-essential dpkg-dev libpcre3-dev libssl-dev zlib1g-dev
COPY docker/build-njs.sh /usr/local/bin/build-njs.sh
RUN sh /usr/local/bin/build-njs.sh

FROM php:7.4-fpm-bullseye

RUN printf '%s\n' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20260901T000000Z/ bullseye main' \
      'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20260901T000000Z/ bullseye-security main' \
      > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nginx-core supervisor curl \
       libfreetype6-dev libjpeg62-turbo-dev libpng-dev libzip-dev libonig-dev libxml2-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j2 gd mysqli pdo_mysql bcmath mbstring zip sockets pcntl opcache \
    && pecl install redis-5.3.7 \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/* /tmp/pear \
    && rm -f /etc/nginx/sites-enabled/default

COPY --from=njs-builder /opt/njs/ /opt/njs/
RUN test "$(dpkg-query -W -f='${source:Version}' nginx-core)" = "$(cat /opt/njs/nginx-source-version)" \
    && test "$(dpkg --print-architecture)" = "$(cat /opt/njs/architecture)" \
    && cp /opt/njs/ngx_http_js_module.so /usr/lib/nginx/modules/ \
    && cp /opt/njs/50-mod-http-js.conf /etc/nginx/modules-enabled/ \
    && nginx -t

WORKDIR /var/www/crmeb
COPY crmeb/ ./
RUN rm -rf public/admin
COPY template/admin/dist/ public/admin/
COPY docker/nginx.conf /etc/nginx/conf.d/crmeb.conf
COPY docker/tenant-headers.js /etc/nginx/tenant-headers.js
COPY docker/supervisord.conf /etc/supervisor/conf.d/crmeb.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/crmeb.ini
COPY docker/entrypoint.sh docker/wait-installed.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/wait-installed.sh \
    && mkdir -p runtime public/uploads backup /var/lib/crmeb \
    && chown -R www-data:www-data /var/www/crmeb /var/lib/crmeb \
    && nginx -t && php-fpm -t

ARG REVISION=local
LABEL org.opencontainers.image.source="https://github.com/lsiten/CRMEB" \
      org.opencontainers.image.revision="$REVISION"
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
    CMD curl --fail --silent http://127.0.0.1/healthz || exit 1
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
