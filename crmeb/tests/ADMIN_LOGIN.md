# 非默认租户管理员登录回归（LSIT-21）

后续 `tenant_code` 扩展已替代下文同名账号的限制，现行请求契约见 `ADMIN_TENANT_CODE.md`；下文保留前一阶段的回归记录。

基准为 PR #45 的 `92e81035cf502685c07224656cde7fc254002e49`。本次只修复 `SystemAdminServices::verifyLogin()`；不修改全局模型作用域、客户端、部署配置或现有数据库。

## 契约与兼容性

`POST /adminapi/login` 仍提交 `account/pwd`，可选验证码字段不变；成功响应、Bearer 使用方式、分页及金额语义不变。认证前仅这次账号查询排除 tenant 作用域；取得唯一未删除账号并校验密码/启用状态后，在该账号原租户下保存 last_time/last_ip/login_count，finally 恢复调用方上下文。原 login 流程随后用原租户签发 token。

创建与编辑管理员的重名检查是租户内检查，安装表 account 也是非唯一索引。测试使用真实 create 服务证实两租户可建立同名账号。因此不能无条件跨租户 find，也不按“第一个密码匹配”猜测身份。查询最多两条未删除记录，仅恰好一条时继续；多条（包含禁用但未删除账号）沿用 HTTP 200、业务 400、`账号或密码错误` 拒绝。已删除重名记录不阻断唯一账号。

这意味着既有跨租户同名账号需要先消除歧义才能登录；本次没有自动改名、全局唯一迁移或新增租户选择字段。若要支持同名登录，应另行设计可信租户选择契约并跨端协调。

## 失败证据与修复

最新基准、同一隔离账号、同一正确密码且 status=1：

```text
TOGGLE tenant_id=2 status=400
TOGGLE tenant_id=1 status=200
TOGGLE tenant_id=2 status=400
FAIL: non-default B administrator logs in to original tenant
```

失败退出 255。只移除查询作用域仍不正确：

```text
HTTP 200 login status=200
B result tenant=1 stored tenant=2
FAIL: non-default B administrator logs in to original tenant
```

模型写钩子使用默认上下文，导致返回模型的 tenant_id 变成 1；原租户 2 的数据库行未按预期更新。完整修复后：

```text
HTTP 200 login status=200
B result tenant=2 stored tenant=2
PASS: login saves timestamp/IP/count without moving B
HTTP 200 setting/info status=200
HTTP 200 tenant/credentials/2 status=200
HTTP 200 tenant/credentials/1 status=403
All admin login checks passed.
```

## 重跑与覆盖

使用现有 PHP 7.4.33/MySQL 8.0.46，无安装依赖：

```bash
TENANT_TEST_PORT=43379 TENANT_TEST_PHP=/opt/homebrew/opt/php@7.4/bin/php bash crmeb/tests/run_tenant_tests.sh admin_login_test.php
TENANT_TEST_PORT=43379 TENANT_TEST_PHP=/opt/homebrew/opt/php@7.4/bin/php bash crmeb/tests/run_tenant_tests.sh
```

新增 23 项通过；全套 123 项通过（23 JWT、48 凭据集成、29 bootstrap HTTP、23 管理员登录），退出 0，无 Warning/Notice/FAIL。4 个变更 PHP 文件 `php -l`、测试脚本 `bash -n`、`git diff --check` 通过。

- 真实 HTTP：非默认租户 B、默认租户 A、超管登录；B token 获取真实 setting/info 与自身凭据、B→A 凭据 403；错误密码/禁用/删除均拒绝。
- 数据库回读：成功登录保存次数、时间、IP，仍属 B；拒绝不修改记录；ORM 测试数据端点只读取 B，query tenant_id=1 不能覆盖。
- 同名：真实服务在两租户创建同名账号，同密码/不同密码均拒绝，任一匹配密码不能选择身份；删除一条后唯一 B 可登录。
- 同进程：verifyLogin 成功以及隔离库触发器强制写失败时，调用方上下文均恢复；异常向上传播，普通模型默认租户作用域仍存在。

HTTP harness 使用真实 admin route/tenant/setting 路由、Login/SystemAdmin/TenantCredential 控制器、认证/角色/日志中间件、AdminApiExceptionHandle、密码校验、JWT 和文件缓存。临时 schema 从安装 SQL 提取所需表，并对缺少 tenant_id 的表在隔离库补列；不是全库安装/升级验收。无登录或认证 mock；唯一 `__test/items` 是测试 ORM 数据端点。未加载安装初始化、验证码服务和自定义事件/队列监听器；菜单/角色为最小测试数据。

每次 runner 新建独立 mysqld 数据目录与随机测试库，结束在 finally/EXIT 关闭 HTTP/MySQL 子进程并删除测试库和缓存。43379 已确认无监听；其他成员测试进程未触碰。

## 验收边界

本轮为作者修复与自测，不替代知衡暂缓的新增服务端独立审查。未复测完整后台浏览器、双客户端/真机、375px 列表、切账号迟到响应、订单/支付/库存/队列、PHP 8.1 或生产环境。文件管理登录 verifyFileLogin 未改动，非本次普通后台登录路径。父任务仍 in_progress；不合并、不部署、不迁移现有数据库。
