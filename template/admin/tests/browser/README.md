# 客服游客隔离验证

固定服务端接口契约：PR #51 `45087ac89aba19a6eade17840babf39bf125b78b`。
本夹具不运行服务端、不连接数据库。仅监听 localhost，用假响应验证真实 Vue 2 / Element UI / Axios 的传输和页面行为；router、cookie工具适配及部分外围组件由测试替身提供，不代表真实坐席认证或完整商城验收。

## 单元测试

在 template/admin 执行：

```sh
node --experimental-vm-modules --test tests/*.test.mjs
```

## 浏览器夹具

复用项目安装的依赖。pnpm 的传递依赖未提升到顶层时，使用命令级 NODE_PATH，不修改产品构建配置：

```sh
NODE_PATH="$PWD/node_modules/.pnpm/node_modules" NODE_OPTIONS=--openssl-legacy-provider node tests/browser/server.cjs /absolute/evidence/browser 18431
```

通过 ego-browser 打开 `http://127.0.0.1:18431/`。必须禁用缓存后刷新，UTF-8页面的旧编码缓存会导致脚本解析失败。所有注入只用临时假值；测试接收器的 `/__events` 在内存中保存原请求头和body，禁止真实凭据，结束关闭服务和浏览器空间。

测试专用 `window.guestTest` 提供：

- `injectTenantCredentials({appid,screct_id})` / `clearTenantCredentials()`：与产品同一模块；生产代码不会导出到 window。
- `api`：真实 `src/api/kefu.js` 全部包装函数；七个游客函数使用独立请求器，其余保留原 request。
- `request` / `prepareGuestUpload(file)` / `uploadGuestFile({file,data})`：直接验证白名单、选图后切换及代际保护。
- `await mount('pc'|'mobile'|'feedback'|'staff')`：挂载真实组件，`page` 为组件实例；`errors` 收集未处理异常。

`POST /__control` 请求 JSON 支持 `reset:true`（清空计数）、`next:{'/kefuapi/tourist/adv':{http:401,response:{status:401,data:{code:'tenant_credentials_invalid'}},delay:true}}`（下一个匹配请求假响应）、`release:true`（释放已到达的延迟响应）。`GET /__events` 只应在本机测试中读取；交付证据需去除凭据值。

实际执行矩阵：

1. 未注入普通调用、上传拒绝且接收器零计数。
2. 七个游客API包装逐一调用：user/adv/chat/feedback GET与POST/order/product；核对两头、用户token业务参数，零后台Bearer，URL无凭据。
3. 当前invalid→普通及上传均零后续发包→新注入恢复。
4. HTTP401用户错误及HTTP503 tenant_auth_unavailable不清租户，不返回Axios配置。
5. 延迟invalid后新注入，释放旧响应得到guest_session_changed，新凭据仍可用。
6. prepareGuestUpload后切换，再uploadGuestFile，零上传发包。
7. PC页/移动页用ego uploadFile向真实ElementUI文件输入选“相册照片.PNG”，核对multipart原始文件名及两头。
8. PC ElementUI上传invalid后两类调用零发包；移动ElementUI延迟invalid不影响新注入。
9. 真实坐席登录表单填假用户名/密码点击登录，核对原字段、坐席cookie与路由；随后设置假后台token调用config，原Bearer仍在且无游客两头。

## 完整生产入口与限制

正常构建后，本服务也可提供 dist：直接访问 `/kefu/appChat`、`/kefu/mobile_user_chat`、`/kefu/mobile_feedback`。在Page初始化脚本记录WebSocket构造调用，清空接收器计数后首次导航；未注入时游客请求及WS均为零。既有main的 `/adminapi/custom_admin_js` 请求仍在，不附游客凭据。

生产接入方须在同一JS运行环境、首次游客调用前导入 `src/libs/kefu-guest-session` 并调用注入接口；本PR没有生产凭据提供方、window/postMessage桥接、storage或公开领取接口。替换/清除清空当前页数据、用户token副本及标题，旧响应被拒绝；不自动重放业务。重新加载应用会丢弃凭据，需要接入方重新注入。

浏览器原生WS仍不支持所需Header，实时聊天/发送订单商品消息保持阻断；HTTP上传成功不代表图片消息送达。生产注入、真实服务端组合认证、WS恢复、小票、回调、完整业务与真机仍需单独验收。不合并、不部署、不操作现有库。
