# 公开租户引导接入

服务端基准：PR #45，`92e81035cf502685c07224656cde7fc254002e49`。在 `config/app.js` 配置 `TENANT_ENTRY` 为服务端已发布的公开入口，API 根地址沿用 `HTTP_REQUEST_URL + /api/`。空 entry 保留原单租户模式；公开客户端不保存 app_secret。

普通请求与三个图片上传入口在发送前匿名 POST `tenant/bootstrap`，只发送 `{entry}` 和 JSON 内容头。tenant_token 仅在内存中保存，业务使用 `X-Tenant-Token`，用户 Bearer 独立。到期前30秒续租，并发引导/续期合并。仅租户401错误码 `tenant_token_invalid` 触发续期；用户401仍进入原登录流程。续期失败停止业务，不回落默认租户。

仅 GET `products`、`user`、`version`（可带查询）最多重放一次。GET 在现有 API 中也可能注销/删除，因此其他请求和所有上传即使续期成功也报错，由用户明确重试；网络错误不重放。

`utils/tenant.js` 导出 `switchTenant(entry)` 供商城入口流程调用；入口切换清除本应用 Storage（保留 locale）、Vuex 用户/首页/购物车/搜索缓存、App 全局推广及用户信息，关闭旧 socket 并重建首页。旧租户/旧用户响应不能恢复新状态，旧 socket 消息有代际保护。没有新增切换 UI。下一次冷启动以配置 entry 为准，含返回空 entry 时清理旧租户数据。

## 验证与边界

- `node --experimental-vm-modules --test tests/*.test.mjs` 执行纯会话及真实请求模块的平台替身测试，VM Modules 有 Node 实验性提示。
- 启动服务端隔离脚本后，在本目录设置 `TENANT_HTTP_BASE`、独立 `TENANT_TEST_PORT`、`TENANT_TEST_PHP` 执行同一命令；增加两租户实际 HTTP、用户401、调用真实服务类重置后恢复的验证。未设环境则显式跳过 HTTP 项。脚本只接受独立实例中的唯一 lsit21_test_* 库，不输出凭据。完成后按服务端提示 Enter 清理。
- package.json 没有平台构建 scripts；H5/微信/App 应由当前 HBuilderX 配置分别构建。Node 请求适配测试不能代替 UniApp 编译和浏览器/真机。
- 微信登录/手机号/支付、原生支付迟到回调、WebSocket 服务端租户协议、完整商城订单库存与页面切换 E2E 尚需对应环境验收。本变更不部署、不迁移现有数据库。
