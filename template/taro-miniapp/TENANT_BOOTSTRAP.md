# 运行时租户 Header 接入（替代旧 bootstrap）

普通业务与上传必须由宿主先调用 `src/services/tenant.ts` 的 `injectTenantCredentials({ appid, screct_id })`。两字段来自运行时接入方，不提供源码字面量、构建变量、URL、storage 或公开 secret 领取接口。尚无生产宿主接入，默认零业务发包，不能直接上线。

- `appid` 对应既有 client_id/app_id，`screct_id` 对应 app_secret。注入接口拒绝非字符串、空白、逗号和控制字符；数据只存模块闭包，快照只含 revision。每次注入（包括同值）或 `clearTenantCredentials()` 都清理租户/用户缓存并使在途操作失效。
- `switchTenant(credentials)` 注入后 reLaunch 首页；宿主必须等待调用完成并重新加载页面状态。用户 Bearer 独立，租户凭据不代表用户已登录。清理 crmeb 前缀 storage、guideDate、用户状态、商品缓存及购物车订阅。
- 普通请求/上传使用规范 `appid`、`screct_id` Header；移除调用者同名/大小写变体、旧 X-Tenant-Token 与用户头，再写入当前身份。缺凭据报 `tenant_auth_required`，不发包。所有业务包括 GET 都不自动重放。
- `tenant_auth_required`、`tenant_credentials_invalid`、`tenant_auth_unavailable`、`tenant_mismatch`、`tenant_bootstrap_unavailable` 先于用户401分流。旧 `tenant_token_invalid` 只拒绝，不续期、不兼容授权。租户错误固定本地消息，不回显服务端凭据；`TENANT_CHANGED` 表示操作所属商城/账号失效。
- Taro 无现有WS传输，DIY导航只允许内部白名单，外部地址明确提示不支持。第三方支付/OAuth跳转不注入租户secret；服务器动态首页/短链/支付小票及回调仍需服务端方案，不等于支付已联调。遥测继续关闭，不能借独立endpoint绕过认证。
- 金额、分页、成功信封不变。生产凭据注入来源、JS执行环境信任、HTTPS域名、真实CORS/网关、微信登录/手机号/支付、App/微信SDK、HBuilderX编译均待验。Taro H5及微信小程序分别构建并留存产物；成功构建不代表SDK或业务已验收。

验证：`pnpm typecheck`、`pnpm test:unit`、`node --test tests/tenant-session.node.mjs`、`pnpm build:h5`、`pnpm build:weapp`。原业务测试通过独立fixture提供已注入租户边界；tenant-request/tenant-http显式取消mock验证真实接入模块，HTTP接收器为隔离合成信封，非LSIT-30认证。