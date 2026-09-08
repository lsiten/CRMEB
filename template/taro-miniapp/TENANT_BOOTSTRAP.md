# 公开租户引导接入

服务端基准：PR #45，`92e81035cf502685c07224656cde7fc254002e49`。客户端仅配置 `TARO_TENANT_ENTRY`（公开入口）及 `TARO_API_BASE_URL`（完整 API 根地址）。服务端须发布对应 entry；空 entry 保留旧单租户模式。公开客户端不保存 app_secret。构建由部署方配置正式 HTTPS 地址和微信请求域名，本变更不部署。

请求前匿名 POST `/tenant/bootstrap`，只发送 `{entry}` 与 JSON 内容头。短期 tenant_token 只在内存保存，业务发送独立 `X-Tenant-Token`，用户 Bearer 不变。TTL 到期前30秒续期，并发合并为一个请求。仅 `401/data.code=tenant_token_invalid` 触发匿名续期；用户401清用户态，不续租。失败停止请求，不回落默认租户。

仅 GET `products`、`user`、`version`（可带查询）允许自动重试一次。旧服务端部分 GET 会注销/删除/交换 code，因此其他方法和路径即使续期成功，也向调用方报商城不可用，须由用户重新操作；图片上传同样不重放。网络错误不自动重放。

`services/tenant.ts` 导出 `switchTenant(entry)`，供自有商城选择流程调用：清除用户、crmeb 前缀存储、guideDate、商品内存缓存；通知原认证订阅者并重建首页。旧租户响应和旧用户上传响应拒绝。入口切换为本次运行有效，下次冷启动以构建入口为准；检测入口变更（含退回默认模式）后清理旧数据。没有新增选择器 UI。

**限制**：租户模式暂禁用旧遥测队列上报，防止未携带租户上下文的旧通道混用；需另行约定遥测租户契约。切租户后订单/支付原生回调、微信登录/手机号/支付仍需真机联调，不因构建通过视为验收。首次冷启动的上传和购物车也经过存储初始化。

## 验证入口

- `pnpm typecheck`、`pnpm test:unit`、`node --test tests/tenant-session.node.mjs`。
- `pnpm build:h5` 与 `pnpm build:weapp`，两者共用 dist，必须分别保存产物。
- 服务端独立终端：`TMPDIR=/tmp TENANT_TEST_PORT=<独立端口> TENANT_TEST_PHP=<PHP7.4> bash crmeb/tests/run_tenant_tests.sh --serve`。只创建新测试库，不连接商城数据库。
- 在本目录设置 `TENANT_HTTP_BASE=<打印的API地址，无末尾斜杠>`、相同 `TENANT_TEST_PORT` 和 `TENANT_TEST_PHP`，运行 `node node_modules/vitest/vitest.mjs run tests/tenant-http.test.ts`。含两租户冷启动、用户401和通过真实服务类重置后的恢复；测试 helper 仅接受该独立实例中唯一 lsit21_test_* 库，不输出凭据。完成后按 Enter 让服务端执行29项检查并清理。
- 未设环境时 HTTP 测试显式跳过。平台 mock 单测不等于 HTTP 或设备验证。
