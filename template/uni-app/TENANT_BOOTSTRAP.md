# 运行时租户 Header 接入（替代旧 bootstrap）

普通业务与上传必须由宿主先调用 `utils/tenant.js` 的 `injectTenantCredentials({ appid, screct_id })`。两字段来自运行时接入方，不提供源码字面量、构建变量、URL、storage 或公开 secret 领取接口。尚无生产宿主接入，默认零业务发包，不能直接上线。

- `appid` 对应既有 client_id/app_id，`screct_id` 对应 app_secret。注入接口拒绝非字符串、空白、逗号和控制字符；数据只存模块闭包，快照只含 revision。每次注入（包括同值）或 `clearTenantCredentials()` 都清理租户/用户缓存并使在途操作失效。
- `switchTenant(credentials)` 注入后 reLaunch 首页；宿主必须等待调用完成并重新加载页面状态。用户 Bearer 独立，租户凭据不代表用户已登录。清理保留 locale，其余商城 storage、Vuex、购物车、分销及 WS 状态按原清理接口处理。
- 普通请求/上传使用规范 `appid`、`screct_id` Header；移除调用者同名/大小写变体、旧 X-Tenant-Token 与用户头，再写入当前身份。缺凭据报 `tenant_auth_required`，不发包。所有业务包括 GET 都不自动重放。
- `tenant_auth_required`、`tenant_credentials_invalid`、`tenant_auth_unavailable`、`tenant_mismatch`、`tenant_bootstrap_unavailable` 先于用户401分流。旧 `tenant_token_invalid` 只拒绝，不续期、不兼容授权。租户错误固定本地消息，不回显服务端凭据；`TENANT_CHANGED` 表示操作所属商城/账号失效。
- 两套 WS 入口明确报 `TENANT_TRANSPORT_BLOCKED`；本轮连可带头的平台也暂不打开，待真实SDK握手及服务端消息复核完成。通用外部 WebView 导航阻断，因为无法注入认证头。第三方微信/OAuth/支付导航不携带租户secret，回调映射未联调；直接访问服务器动态首页/短链/支付小票仍由服务器拒绝，不能用静态壳替代认证。
- 金额、分页、成功信封不变。生产凭据注入来源、JS执行环境信任、HTTPS域名、真实CORS/网关、微信登录/手机号/支付、App/微信SDK、HBuilderX编译均待验。本仓库UniApp package.json无构建scripts，本轮Node VM适配器测试不等同UniApp编译或真机通过。

验证：`node --experimental-vm-modules --test tests/*.test.mjs`。假凭据仅在测试内，测试不打包。旧 bootstrap HTTP 测试契约已替换；本轮不调用旧诊断路由或旧重置脚本。
