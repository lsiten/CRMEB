LSIT-30 强制 Header 租户认证

基准：已合 master `a48a3be15988500346dcdc05ce4ccd215e739b9f`。本契约替代 TENANT_CREDENTIALS.md 中 C 端默认租户、X-Tenant-Token 独立访问和公开 bootstrap 兼容；后台凭据生成/重置规则不变。服务端切换会中断旧客户端和第三方回调，尚不具备整体上线条件。

## 请求与错误

每个普通业务请求（包括登录、GET、上传、客服游客、脚本、小票、短链）发送 Header `appid`、`screct_id`。appid 对应已生成的 client_id/app_id（32位小写hex），screct_id 对应 app_secret（64位小写hex），不是新数据库ID。头名大小写不敏感；ThinkPHP在不同SAPI会把下划线头存成不同形式，服务端兼容原始/规范化形式。不要将凭据放到URL、表单或JSON；这些位置不会认证或覆盖Header选定的租户。显式 tenant_id 与认证结果不一致时拒绝。

用户 Bearer 独立，不能补足租户认证；旧 X-Tenant-Token 被忽略，单独发送时拒绝。POST /api/tenant/token 只读上述Header，成功仍返回 tenant、tenant_token、expires_in，但其返回令牌不能独立取数据。POST /api/tenant/bootstrap 即使带有效Header也关闭；服务层公开签发函数也关闭，白名单配置不再授予访问权。未迁移、重置或轮换任何现有凭据。

普通认证失败HTTP200，JSON `{status,msg,data:{code}}`，no-store，data仅错误码，固定文本不回显。拒绝响应及专用TenantAuthException均绕过会读取商城语言数据的 Json/getLang（包括AuthException原构造函数）。成功金额、币种、分页与业务字段未改。

| 情况 | status / data.code |
| --- | --- |
| 缺任一头、空值、只有参数/旧token/Bearer | 401 / tenant_auth_required |
| 格式错误、合并重复值、未知ID、错误secret、停用/删除、重置旧凭据 | 401 / tenant_credentials_invalid |
| 认证存储不可用 | 503 / tenant_auth_unavailable |
| 显式目标租户、用户JWT归属冲突 | 403 / tenant_mismatch |
| 有效头访问bootstrap | 403 / tenant_bootstrap_unavailable |

## 全入口映射

`tenant_header_routes.tsv` 保留 LSIT-29 的373条声明（v1 299、v2 41、pc 24、客服游客8、短链1），逐行给出方法、路径、策略和基准源码位置。373是声明数量，不是完整业务成功分支数量。

- API应用层：AllowOrigin → TenantCallback → TenantToken，早于 StationOpen/用户中间件/控制器；6个协议入口另外在准确路由声明上绑定关闭中间件，避免路径变体绕过。其他API全需Header，包括11个HTTP crontab入口；没有增加匿名调度例外。调度器仍须另行验收其原有权限和任务行为。
- 客服游客8条：路由组先验Header；工作台登录/坐席接口保持独立身份契约，不宣称其登录前配置已改造。游客聊天/订单仍保留原有用户认证，不因租户凭据授予其他用户数据权限。
- `/surl/:id` 在实例化业务控制器前验Header。根桌面兜底渲染 mobile.html 前验Header再注入 site_name/site_url；手机静态壳、admin/kefu/app壳、已有静态文件不注入新增凭据。
- public/service_pay_result.html 源模板未植入secret，原有匿名Ajax现在会收到拒绝，支付嵌入页面不可用；/api/service_pay_result 和 get_script/custom_pc_js 均受认证，不能随服务回调组匿名放行。
- 直接静态图片、CDN、已发布导出链接、浏览器/ServiceWorker缓存不由PHP中间件收回；未将其计作受控数据接口。独立PC源码缺失，未改压缩产物。

## 第三方协议：当前全部关闭，不计回调完成

以下各路由对普通请求返回HTTP503固定文本（OPTIONS仍仅预检），不返回支付成功ACK、不读默认租户业务数据、不尝试各租户密钥。后续必须提供可信账户/商户到租户映射并按原协议验签、订单归属和幂等回归后才能单独开放。不能以请求tenant_id、未验签appid或Host作为信任依据。

| 路由 | 原处理链/签名边界，尚待验证的绑定 |
| --- | --- |
| ANY /api/wechat/serve | WechatController::serve → WechatServices/WechatService::serve；原微信服务SDK签名/加密，缺公众号账户到租户的可信定位 |
| ANY /api/wechat/miniServe | WechatController::miniServe → 小程序服务SDK；缺小程序账户到租户绑定 |
| ANY /api/pay/notify/:type | PayController::notify 按 alipay、wechat、routine、v3wechat、allin* 选SDK；WechatService/MiniProgramService::handleNotify、AliPayService、V3WechatPay::handleNotify、AllinPay::handleNotify 后进入通知业务；本轮未证明各渠道签名与商户/订单归属全链正确，缺可信租户定位，不能默认1 |
| ANY /api/transfer/notify/:type | V3WechatPay::handleTransferNotify → SDK successful → NotifyListener；缺商户到租户绑定及重复转账回调回归 |
| ANY /api/order_call_back | StoreOrderController::callBack 用 sms_token 解密后处理物流；缺服务商身份/完整性验证及租户绑定，不能把解密成功等同于独立验签完成 |
| POST /api/sms/pay/notify | PublicController::sms_pay_notify 基于status推送消息，所读控制器没有独立验签；缺上游认证协议和可信租户绑定 |

这是切换阻塞，不是回调功能交付通过。不得在此版本直接切换生产支付。没有虚构新回调凭据，也没有向浏览器发送平台密钥。

## 长连接与跨端交接

ChatService 的消费者连接仅从WS握手HTTP Header取凭据，重复头/错误凭据关闭。仅记录client_id、tenant_id和摘要的版本指纹，不保留明文secret。普通消息前、推送前及在线清理前校验当前凭据版本/启用状态；失效停止业务，跨租户推送被阻止；finally清理消息上下文。坐席 kefu_login 在账户查询前检查JWT签名、type=kefu、tenant_id及令牌缓存，再核验坐席启用和租户归属，不能以用户JWT或无Header消费者login/to_chat绕过。旧无tenant_id的坐席JWT需重新登录。移除消费者/后台WS原有消息全量var_dump，避免token日志。

浏览器原生WebSocket无法添加这两个自定义头，因此H5/客服游客浏览器WS仍阻塞。未用URL、首条消息、公开entry或模板注入secret作为替代。完整WS网络握手、连接重连、游客ID碰撞、跨worker Channel和定时器全部业务路径尚待专门联调；当前WS测试是实际凭据服务＋连接发送替身，不能当成真实浏览器WS通过。

明镜需配置正式网关 `underscores_in_headers on`、保留ThinkPHP路由转发、CORS错误响应、关闭敏感Header/APM日志，并适配客服Web直接上传/请求/长连接。PHP会规范化连字符/下划线，网关须约束歧义/重复头，不能假定PHP能还原全部原始拼写。测试网关开/关下划线的两个端口均验证；生产配置未改。

星舟需改UniApp/Taro全部请求和原生uploadFile，取消匿名bootstrap/旧token重放，保持切租户在途响应隔离；分享、扫码、OAuth跳转、iframe/脚本加载及浏览器导航无法直接携带Header的路径须交接。公开客户端里的长期secret不会因放在Header就保密，提供方/可信代理需由知衡协调，未内置任何实际secret到仓库、模板或编译包。

## 可重跑验证

- `php crmeb/tests/tenant_header_gate_test.php`：旧版先失败（missing headers进入业务），新版缺头5场景和畸形凭据语言读取陷阱通过；后者曾先失败，已改专用异常。
- `bash crmeb/tests/run_tenant_header_http.sh`：新建MySQL8/Redis、产品副本、PHP7.4正式public/index.php、Nginx/FPM；373条缺凭据声明遍历、代表组缺一头/仅token/Bearer、无业务SQL审计、业务表快照、两租户配置/广告/商品/反馈写入、用户跨租户、Header大小写、重复头、Nginx下划线开/关、路径变体、OPTIONS/CORS/no-store、6回调关闭、重置/停用/删除/存储故障、WS发送边界。
- `php crmeb/tests/tenant_header_log_test.php`（7.4/8.1）：实际API/客服/全局异常及HttpEnd日志，包含响应中生成的secret/token；另通过LogWrite统一脱敏SDK/SQL日志，断言仅脱敏内容落盘。
- `TENANT_TEST_PHP=/opt/homebrew/opt/php@7.4/bin/php TENANT_TEST_MYSQLD=/opt/homebrew/opt/mysql@8.0/bin/mysqld TENANT_TEST_PORT=43965 TMPDIR=/tmp bash crmeb/tests/run_tenant_tests.sh`：保留JWT type、管理员、凭据并发与重置回归；旧公开bootstrap测试已改为关闭断言。
- 改动PHP文件使用PHP7.4/8.1逐文件lint，`git diff --check`。

HTTP测试只对专属新库运行仓库已有安装/租户SQL；环境副本不读现有.env。临时服务均为当前shell精确子PID，EXIT等待退出后删除临时数据，未后台交付。脚本默认端口43961–43964并检查占用；可用环境变量改端口和二进制路径。

测试准备曾因macOS socket路径过长失败，改短临时路径；初始Nginx漏s参数误入根页面，相关早期结果作废，修为仓库同类转发后完整重跑。最终结果以交付日志为准。没有运行支付/退款/库存/队列完整业务、真机、真实浏览器、生产入口或迁移现有库；未覆盖全部373成功分支。构建/语法通过不代表这些范围通过。
