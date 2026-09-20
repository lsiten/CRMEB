ARG APP_IMAGE=crmeb:local
FROM node:22.19.0-bullseye-slim AS node
FROM ${APP_IMAGE}
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY docker/test-tenant-headers.mjs docker/nginx.conf docker/tenant-headers.js /opt/header-test/docker/
COPY help/docker/nginx/vhost.conf /opt/header-test/help/docker/nginx/vhost.conf
ENV HEADER_TEST_NJS_MODULE=/usr/lib/nginx/modules/ngx_http_js_module.so
USER www-data
ENTRYPOINT ["node", "/opt/header-test/docker/test-tenant-headers.mjs"]
