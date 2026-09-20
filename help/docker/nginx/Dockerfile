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

FROM debian:bullseye-slim
RUN printf '%s\n' \
      'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian/20260901T000000Z/ bullseye main' \
      'deb [check-valid-until=no] http://snapshot.debian.org/archive/debian-security/20260901T000000Z/ bullseye-security main' \
      > /etc/apt/sources.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nginx-core ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default
COPY --from=njs-builder /opt/njs/ /opt/njs/
RUN test "$(dpkg-query -W -f='${source:Version}' nginx-core)" = "$(cat /opt/njs/nginx-source-version)" \
    && test "$(dpkg --print-architecture)" = "$(cat /opt/njs/architecture)" \
    && cp /opt/njs/ngx_http_js_module.so /usr/lib/nginx/modules/ \
    && cp /opt/njs/50-mod-http-js.conf /etc/nginx/modules-enabled/ \
    && nginx -t
CMD ["nginx", "-g", "daemon off;"]
