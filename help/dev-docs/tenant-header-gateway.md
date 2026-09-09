# 租户 Header 网关交接（LSIT-21 / LSIT-30）

本配置负责传输边界，租户认证由 LSIT-30 服务端实现。`appid` 对应已有 client_id/app_id，`screct_id` 对应 app_secret；只从请求头传递，不转换为 URL、query、表单或 JSON 参数，也不生成默认凭据。公开客户端中的长期 secret 不会因为放进 Header 就变成秘密。

## Nginx → PHP-FPM

- 正式 `docker/nginx.conf` 和旧开发 `help/docker/nginx/vhost.conf` 均开启 `underscores_in_headers on`。外层 CDN/Ingress/反向代理也必须保留下划线头；多虚拟主机部署应在对应监听端口的默认 server 或 http 层设置，不能只改应用的非默认虚拟主机。
- Bullseye 的 Nginx 1.18 不能依赖新版 `$http_*` 的重复头合并行为。引入发行版配套 `libnginx-mod-http-js`，通过 njs `rawHeadersIn` 在 FastCGI 归一化前检查原始头。最低 njs 0.4.3，使用 `js_import`、`js_set`，不引入外部 JS 包。
- 头名大小写不敏感。单个规范头保持原值；缺头传空值；同名重复（包括同值、大小写变化、空值）及 `screct-id` 变体传固定的逗号 `,`，使服务端按格式错误拒绝，不选择其中一个值。单独的 `screct-id` 也不是凭据别名。两个字段各自处理，若另一头缺失，错误优先级仍由 PHP 契约决定。
- 显式设置一次 `HTTP_APPID` / `HTTP_SCRECT_ID`，让 FastCGI 模块抑制归一化后同名的原始头；其余 Header（包括用户认证）、请求体、query 不改。服务端必须拒绝逗号等非法凭据，不可只取合并值的首项。
- `/notice`、`/msg` 同样发送检查后的规范头并删除 `screct-id`。这只保证代理头传输，不实现可信代理，也不解决浏览器原生 WebSocket 无法设置自定义 Header 的阻塞；不注入 secret，不改变 WS 服务端认证职责。

## OPTIONS、错误与日志

OPTIONS 继续进入 PHP，由应用统一返回固定预检；网关不加入 `Access-Control-*`，不提前返回成功。`fastcgi_intercept_errors off` 保留上游信封、HTTP 状态、CORS 和 `Cache-Control: no-store`。缺头/无效头/存储故障的真实认证与拒绝响应 CORS 均依赖 LSIT-30；仅合入网关不能宣称已强制认证。

Nginx 自身的 404/413/502 等错误不伪装为业务错误、不凭空添加跨域授权，浏览器可能只看到网络/CORS错误。应用接收器的 403/503 透传成功不证明网关生成的错误也有业务信封。

访问日志采用 `tenant_safe`：只记 IP、时间、方法、`$uri`（不含 query）、协议、状态、字节数和耗时，不记录 Header、请求体、Referer、User-Agent。错误日志保持 warn，不启用 debug/info；njs 不打印值。Nginx 内建错误日志可能带请求行，故凭据始终不得放 URL；PHP异常、外层代理、APM日志脱敏需各自验证，不能从本测试推断全链路安全。

## 构建与隔离验证

正式 Dockerfile 从原有固定 Debian 快照安装配套 njs 包，由 Debian 的 `modules-enabled` 配置加载；复制 `docker/tenant-headers.js`。构建时现有 `nginx -t` 会阻止模块缺失或配置错误的镜像交付。

旧源码开发 Compose 的 Nginx 改用 `help/docker/nginx/Dockerfile` 本地构建，使用相同 Bullseye 快照与 njs 包；不再假设原第三方 Nginx 镜像包含模块。开发配置和共享 JS 通过挂载使用，日志挂到 `/var/log/nginx`。需要重新构建开发 nginx 镜像；MySQL、Redis、PHP 及其数据卷未更改。此方案仍不作为正式部署入口。

已具备 Node.js 18+、Nginx+njs、PHP-FPM 的隔离环境可使用普通用户运行（不以 root 运行测试池）：

```sh
HEADER_TEST_NGINX=/path/to/nginx \
HEADER_TEST_PHP_FPM=/path/to/php-fpm \
HEADER_TEST_FASTCGI_PARAMS=/path/to/fastcgi_params \
node docker/test-tenant-headers.mjs
```

动态模块需另传 `HEADER_TEST_NJS_MODULE=/path/to/ngx_http_js_module.so`。脚本只启动自己拥有的进程，绑定本机随机端口，使用临时目录和虚构凭据，结束时回收进程及文件，不连接数据库。读取两份实际站点配置，仅替换端口、路径、测试上游；缺少工具或断言失败即退出非零。`HEADER_TEST_BASELINE=1` 可对照 `origin/master` 的修复前配置。

接收器测试覆盖透传、大小写、缺头、错误、重复及连字符冲突、用户认证/请求体保留、OPTIONS、应用403/503、日志。接收器生成的信封用于断言传输，不是 CRMEB 的租户认证结果。正式镜像、双架构、外层代理、真实两租户/重置/停用、支付回调及 WS 握手/消息仍需准确版本组合验证。LSIT-30 交付准确 PR/SHA 后，由知衡安排组合联调；不修改现有部署、不迁移数据库、不自动合并。

依据：[Nginx 下划线头配置](https://nginx.org/en/docs/http/ngx_http_core_module.html#underscores_in_headers)、[njs 原始头](https://nginx.org/en/docs/njs/reference.html#r.rawHeadersIn)、[njs 模块](https://nginx.org/en/docs/http/ngx_http_js_module.html)、[Nginx 1.18 FastCGI 源码](https://github.com/nginx/nginx/blob/release-1.18.0/src/http/modules/ngx_http_fastcgi_module.c)。
