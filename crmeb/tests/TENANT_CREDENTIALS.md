## LSIT-21 服务端契约与验证

`client_id` 是规范名称，`app_id` 为同值别名。服务端接收二者之一，同时传入必须一致。

| 接口 | 认证与请求 | 成功 data |
| --- | --- | --- |
| GET /adminapi/tenant/credentials/:id | 后台 Bearer，自己的租户；level=0 可管理任意租户 | tenant_id, generated, client_id, app_id |
| POST /adminapi/tenant/credentials/:id | 同上，无需请求体；重复生成 409 | tenant_id, client_id, app_id, app_secret |
| POST /adminapi/tenant/credentials/:id/reset | 同上，无需请求体；尚未生成 400 | 同上；ID 不变，secret 更换 |
| POST /api/tenant/token | JSON: client_id（或 app_id）, app_secret | tenant:{id,name,code}, tenant_token, expires_in:3600 |

新接口使用 HTTP 200 和 `{status,msg,data?}`：200 成功，400 参数错误，401 无效/过期凭据，403 越权，404 租户不存在，409 已生成。后台登录失败保留既有行为。无分页或金额变化。

后台兼容 `Authori-zation` 和 `Authorization: Bearer ...`。普通管理员不下发租户管理菜单，并拒绝租户 CRUD、管理列表及切换；凭据接口单独做账号所属租户检查，不依赖菜单可见性。level=0 可管理任意租户凭据。

secret 为随机 32 字节的 hex，只在生成/重置时返回，查询不返回，库内仅保存 SHA-256 摘要。响应禁止缓存。`tenant_id` 主键保证每租户一组，`client_id` 唯一索引保证跨租户唯一；事务同时锁定租户行及凭据行，避免 MySQL REPEATABLE READ 下读到旧快照。

公开客户端不得保存 app_secret。可信服务端通过 TLS 交换短期 tenant_token，再交给 H5/小程序/App；后续请求以 `X-Tenant-Token` 传递，登录用户 Bearer 仍独立传递。租户令牌只选择商城，不授予用户或管理员身份。重置立即使旧 secret 和旧租户令牌失效；禁用/删除租户拒绝新交换及令牌使用。可信 bootstrap 服务须自行配置允许的租户，不能把 secret 下发给客户端。

API 应用中间件在路由业务前建立租户上下文并在结束时清理。显式无效租户令牌拒绝，不回落；用户令牌租户不匹配返回 403，包括可选登录接口。无租户令牌沿用旧默认租户/用户令牌逻辑。

迁移：审核后在目标安装的备份/恢复流程下执行 `upgrade/tenant_credentials.sql`，自定义表前缀先替换 eb_。依赖已有 tenant 表。此变更没有自动执行迁移。回滚先停用新接口/客户端入口，再删除新凭据表；原业务表未改写。不得直接作为线上操作指令执行。

明镜：凭据入口放在租户自身设置；超级管理员可由租户列表进入任意租户凭据，secret 只展示一次。星舟：可信 bootstrap、租户令牌及用户令牌分别管理，切换租户先清理旧用户会话。调度及非作者验收由知衡负责。

## 本地隔离测试

使用已有 PHP 7.4、MySQL 8.0，单独初始化 MySQL 数据目录并绑定本机非默认端口。不要指向已安装商城数据库。测试只允许 `lsit21_test_<hex>` 数据库名和非 3306 端口，CREATE DATABASE 不复用旧库，finally 删除本次数据库。

```sh
TENANT_TEST_DATABASE=lsit21_test_a986 TENANT_TEST_PORT=43367 /opt/homebrew/opt/php@7.4/bin/php crmeb/tests/tenant_credentials_test.php
```

覆盖凭据/控制器越权拒绝、超级管理员列表与凭据操作、真实 ORM 两租户读写隔离、真实签名用户令牌跨租户拒绝（令牌缓存为内存替身）、可选登录、菜单过滤、别名、重置/禁用/篡改/过期、8 进程并发首次生成。测试通过 Composer autoload 和框架 helper 引导，不加载部署 .env，不启动商城、队列或支付。

限制：本机 PHP 8.1 在仓库既有 ThinkORM `PDOConnection::getRealSql()` 整数绑定 SQL 日志格式化处报 TypeError；未改 vendor，不能宣称 PHP 8.1 集成通过。测试不是完整安装商城 HTTP/E2E 验证，也不是全库所有 DAO/原生 SQL/缓存的隔离审计。双客户端、后台构建、登录 UI、订单金额/库存、支付回调的租户定位、队列重试和线上环境均未验证。既有无租户令牌默认路径及第三方回调保持原行为，不能据此认定全商城多租户上线验收完成。
