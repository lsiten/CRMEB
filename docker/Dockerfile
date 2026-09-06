FROM php:7.4-fpm-bullseye

RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor curl \
       libfreetype6-dev libjpeg62-turbo-dev libpng-dev libzip-dev libonig-dev libxml2-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j2 gd mysqli pdo_mysql bcmath mbstring zip sockets pcntl opcache \
    && pecl install redis-5.3.7 \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/* /tmp/pear \
    && rm -f /etc/nginx/sites-enabled/default

WORKDIR /var/www/crmeb
COPY crmeb/ ./
RUN rm -rf public/admin
COPY template/admin/dist/ public/admin/
COPY docker/nginx.conf /etc/nginx/conf.d/crmeb.conf
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
