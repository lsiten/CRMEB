# 售后详情真实 HTTP 契约回归

从 `template/taro-miniapp` 执行：

```sh
pnpm install --frozen-lockfile --offline
pnpm exec tsc --noEmit -p tests/integration/tsconfig.json
php tests/integration/refund-http.php
```

需要 PHP 8.1、PDO SQLite、已有 `crmeb/vendor` 依赖、Node 和 pnpm。Multica 环境运行前用 `multica daemon status --output json` 读取 daemon PID，并通过 `REFUND_PROTECTED_PID` 传入 PHP 命令；清理只针对本脚本启动的 HTTP 子进程。

测试复用 `crmeb/tests/refund_fixture.php` 的精简 SQLite schema 与 `refund_http_router.php` 的生产路由、JWT、认证中间件和 DAO/ORM。仅在新建临时数据库中补完整商品快照，以及申请100、实退60数据；不读取部署配置、现有业务库或用户凭据，不更改服务端文件。测试结束清理服务与夹具，并断言售后/订单行未变化。认证中间件可能更新合成用户的登录时间。

PHP runner 分别以 `TARO_ENV=h5/weapp` 运行同一套12项测试。Taro 存储与原生网络桥替换为内存存储及仅允许回环 GET 的 Node HTTP 适配；`getRefund`、请求层、认证失效和商品/金额解析均使用生产实现。合成 JWT 只通过子进程环境传递，不写入测试日志。

覆盖合法详情及完整商品快照、申请额与实退额分离、同租户跨账号、跨租户、同uid跨租户、关联订单错属/跨租户/缺失、不存在售后、第二租户合法详情、匿名/无效token的401及重新登录恢复、跨账号拒绝后恢复。请求头核对 H5 的 `Form-type=h5` 和微信的 `routine`，以及历史认证头存在。

测试使用独立 Vitest 配置，文件名为 `.integration.ts`，不会混入 `pnpm test:unit`。专用 tsconfig 将新测试纳入严格类型检查。

边界：这是完整商品快照下的服务层真实 HTTP 联调，不是浏览器或微信真机验收；H5/微信标签只代表共享请求代码的平台分支。没有验证 UI、列表分页、真实登录接口、手机号、支付/退款执行、合法物流、完整安装库、MySQL或UniApp。图片为合成占位地址，不下载。既有单测仍负责页面状态和金额渲染；本批不增加售后写入口。
