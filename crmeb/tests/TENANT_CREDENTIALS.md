## LSIT-21 服务端契约与验证

`client_id` 是规范名称，`app_id` 为同值别名。服务端接收二者之一，同时传入必须一致。

| 接口 | 认证与请求 | 成功 data |
| --- | --- | --- |
| GET /adminapi/tenant/credentials/:id | 后台 Bearer，自己的租户；level=0 可管理任意租户 | tenant_id, generated, client_id, app_id |
| POST /adminapi/tenant/credentials/:id | 同上，无需请求体；重复生成 409 | tenant_id, client_id, app_id, app_secret |
| POST /adminapi/tenant/credentials/:id/reset | 同上，无需请求体；尚未生成 400 | 同上；ID 不变，secret 更换 |
| POST /api/tenant/token | JSON: client_id（或 app_id）, app_secret | tenant:{id,name,code}, tenant_token, expires_in:3600 |
| POST /api/tenant/bootstrap | 匿名 JSON: entry；入口须在服务端公开白名单 | 与 token 交换相同；无 secret |

新接口使用 HTTP 200 和 `{status,msg,data?}`：200 成功，400 参数错误，401 无效/过期凭据，403 越权，404 租户不存在，409 已生成。后台登录失败保留既有行为。无分页或金额变化。

后台兼容 `Authori-zation` 和 `Authorization: Bearer ...`。普通管理员不下发租户管理菜单，并拒绝租户 CRUD、管理列表及切换；凭据接口单独做账号所属租户检查，不依赖菜单可见性。level=0 可管理任意租户凭据。

secret 为随机 32 字节的 hex，只在生成/重置时返回，查询不返回，库内仅保存 SHA-256 摘要。响应禁止缓存。`tenant_id` 主键保证每租户一组，`client_id` 唯一索引保证跨租户唯一；事务同时锁定租户行及凭据行，避免 MySQL REPEATABLE READ 下读到旧快照。

公开客户端不得保存 app_secret。本服务端现在提供白名单 bootstrap（详见下节）；独立可信服务也可继续通过 TLS 交换短期 tenant_token，再交给 H5/小程序/App。后续请求以 `X-Tenant-Token` 传递，登录用户 Bearer 仍独立传递。租户令牌只选择商城，不授予用户或管理员身份。重置立即使旧 secret 和旧租户令牌失效；禁用/删除租户拒绝新交换及令牌使用。

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

## 公开 bootstrap：星舟接入与部署交接

提供方是本 CRMEB 服务端，不依赖假定存在的外部服务。`tests/tenant_bootstrap.php` 仍然只是测试引导，产品接口为 `POST /api/tenant/bootstrap`。

部署配置 `config/tenant_bootstrap.php` 默认 `entries=[]`，关闭公开签发。由部署方确定允许匿名访问的商城后，将固定入口绑定到已生成凭据的 **client_id**：

```php
return ['entries' => [
    'store-a' => '<租户 A 的真实 client_id>',
    'store-b' => '<租户 B 的真实 client_id>',
]];
```

以上占位符不能直接上线；不放 secret。不存在实际部署映射时保持空配置。entry 是公开商城标识，不是口令；任何匿名客户端都可选择白名单中任意入口。这不适用于依赖入口保密的私有租户，私有租户不可加入该白名单。Host、X-Forwarded-Host、Origin、请求 tenant_id 和 client_id 都不参与选择；只有服务端配置决定映射。域名校验仍由部署网关处理，不能拿 CORS 当租户认证。

请求不带旧租户令牌或用户 Bearer。JSON 只接受 entry，入口标识为 1–64 位字母、数字、下划线、短横线：

```http
POST /api/tenant/bootstrap
Content-Type: application/json

{"entry":"store-a"}
```

成功：HTTP 200，`{"status":200,"msg":"success","data":{"tenant":{"id":1,"name":"A","code":"a"},"tenant_token":"<短期令牌>","expires_in":3600}}`。响应 `Cache-Control: no-store`；不含 secret 或摘要。

| 场景 | 业务 status | data.code | 客户端处理 |
| --- | --- | --- | --- |
| 非法/多余请求体字段 | 400 | tenant_bootstrap_invalid_request | 修正配置或请求，不重试业务 |
| entry 未发布、白名单空 | 403 | tenant_bootstrap_unavailable | 显示入口不可用，停止业务 |
| 映射格式错误、凭据未生成、租户禁用/删除 | 503 | tenant_bootstrap_unavailable | 等待部署方处理，不回落默认商城 |
| 后续 X-Tenant-Token 无效、过期、重置撤销 | 401 | tenant_token_invalid | 清旧令牌，以无认证头 bootstrap 一次；失败停止 |
| 用户登录失效、错误 JWT type | 401 | 无上述租户错误码 | 进入用户登录流程，不反复 bootstrap |
| 用户令牌与当前租户不匹配 | 403 | 无上述租户错误码 | 清旧租户用户态，重新登录当前租户 |

HTTP 状态与业务 status 分离，沿用项目兼容行为。不要按 msg 文案识别续期。X-Tenant-Token 失败发生在进入业务前；仅此明确错误可在成功续期后重放原请求一次，其他网络/业务失败不得盲目重放订单等非幂等操作。切 entry 时清用户令牌、购物车及所有租户相关客户端缓存，再取得新入口令牌；用户鉴权始终独立。

内置 bootstrap 直接在可信服务端根据白名单调用现有签发器，读取实时凭据摘要签名，不恢复 secret，也不要求复制 secret 到另一套配置。生成/重置沿用原接口；client_id 不变，所以重置无须更新 entries。旧令牌立即失效，下一次引导用新摘要签发。签发器不缓存凭据或令牌；重置期间已在执行的请求不提供事务级撤销保证。独立服务若仍调用 secret 交换，则必须安全更新其明文 secret。

变更 entries 后刷新部署配置缓存并重启相关常驻 PHP 进程；禁用 entry 仅阻止新签发，已签发令牌仍可用至到期，如需立即撤销则重置凭据或禁用租户。上线还需审核建表 SQL、准备凭据及映射、配置 HTTPS/小程序合法请求域名及网关限流。这些部署操作本次均未执行。

## 可重复的双租户隔离联调

已有 PHP 7.4（pdo_mysql/curl；交互模式另需 pcntl）、MySQL 8.0、openssl、bash 即可；不安装依赖、不读取已安装商城 .env。以下命令在仓库根目录运行：

```sh
TENANT_TEST_PHP=/opt/homebrew/opt/php@7.4/bin/php bash crmeb/tests/run_tenant_tests.sh
# 人工/客户端联调：前台保留两个入口，按 Enter 后执行重置等检查并关闭
TENANT_TEST_PHP=/opt/homebrew/opt/php@7.4/bin/php bash crmeb/tests/run_tenant_tests.sh --serve
```

脚本创建全新临时 MySQL 数据目录，监听 127.0.0.1:43368（冲突可通过 TENANT_TEST_PORT 改为另一非默认端口），使用 `--no-defaults`，运行结束关闭自己启动的进程并删除临时目录。每套测试 CREATE 随机 `lsit21_test_<hex>` 数据库，finally 删除。客户端联调输出实际本机随机端口，例如 `http://127.0.0.1:<port>/api/`，入口为 store-a/store-b，对应隔离租户 1/2；用 bootstrap 返回令牌访问 `GET /api/__test/items`，各自只能读到一条所属租户数据。按 Enter 正常收尾；Ctrl-C 会进入清理。未保留后台服务。

`__test/items`、`__test/user` 仅注册在隔离 HTTP harness，不是商城产品接口。此 harness 加载真实 v1 路由、CORS/租户中间件、控制器、签名、数据库查询；它不执行完整安装商城初始化，不提供业务登录页。局域网/手机真机不可直接访问 127.0.0.1；真实跨端验证需另行准备可达的隔离服务与平台域名配置。

新增验证实测（PHP 7.4.33/MySQL 8.0.46）：23 项 JWT 类型隔离 + 原 48 项租户集成 + 29 项 HTTP = 100 项通过。HTTP 包含 A/B 冷启动与 ORM 隔离、Host/参数覆盖拒绝、公开响应字段、CORS/no-store、真实 api JWT 成功、admin UID 碰撞 401、用户跨租户 403、错误识别、重置续期、禁用及空白名单。JWT/HTTP 使用真实文件缓存，原集成测试的令牌缓存仍为替身。

JWT 缺陷定位：基线 `e5b616982df727971e8de66b4ff22d9f55b85b6c` 已在 UserAuthServices 解析 type 后未限制 api，非本 PR 引入。缓存 tag 仅用于清理索引，不是读取命名空间。失败回归先观测 `FAIL: expected denial: admin UID collision must not authenticate user 11`（退出 255），加验签后的 type 检查后 23 项通过，HTTP 亦确认 admin 令牌不能变成用户身份。相邻后台/客服认证入口也存在未检查 type 的历史代码，本次只修复已复现的 C 端用户认证碰撞，反向攻击条件及其他认证域需另立范围验证。
