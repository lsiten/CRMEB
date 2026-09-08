# 可选租户编码与切换响应回归

本轮基于后台 PR #46 的 `c1e02de6cf1396f0b0828484592587b869adf42d`，独立分支保留全部已有改动。唯一产品修改范围为 `template/admin/`；服务端联调使用独立、干净的 `eeba816734253d0d11b9d8324429bfcaa9b2a6ae` checkout，没有合并或同步旧后台分支的服务端依赖。

## 行为与接口

- `POST /adminapi/login` 新增可选 `tenant_code`：文本输入最多64字符，trim 后非空才提交；空值省略，保留 account/pwd/key/captchaType/captchaVerification。错误编码不自动重试其他租户。验证码开启时仍先展示 Verify，错误响应仍更新 login_captcha。
- 租户切换捕获发起时的租户 ID、账号与 token；关闭、路由变化、退出确认或销毁使旧请求失效。切换及后续菜单响应写入前检查上下文；旧错误和 finally 不影响新的操作。列表响应同样检查会话。重复点击不改变首请求的 fallback 目标。
- 无分页、金额或后端响应契约变更。

## 执行入口

Node 22.19.0，复用已有依赖时设置 `NODE_PATH` 指向其 `node_modules/.pnpm/node_modules`；没有安装依赖或改动锁文件。

```sh
node --test tests/tenant-credentials.test.cjs tests/tenant-switch.test.cjs tests/tenant-login.test.cjs
node node_modules/eslint/bin/eslint.js --no-ignore src/layout/navBars/breadcrumb/user.vue src/pages/account/login/index.vue
NODE_OPTIONS='--openssl-legacy-provider --max-old-space-size=6144' node node_modules/@vue/cli-service/bin/vue-cli-service.js build --mode=production
test -s dist/index.html
git diff --check
```

最初7项竞态回归在原版全部失败，修复后通过。最终共28项（原凭据13、切换10、登录5），API/存储/刷新使用 fixtures，组件脚本由真实 Vue 实例加载；不等于跨标签浏览器 E2E。独立检查额外验证正常 token 轮换及异步菜单后单次刷新，已加入永久回归。

## 真实 HTTP / 浏览器

```sh
ADMIN_LOGIN_SERVER=/path/to/clean/exact/server-checkout node tests/serve-login.cjs
```

仅供本机测试。需要 PHP7.4、MySQL，二进制可通过 TENANT_TEST_PHP/TENANT_TEST_MYSQLD 指定。启动器核对服务端准确 SHA，新建随机 MySQL 端口、临时 datadir、测试库和缓存。`tests/login-ready.json` 仅为运行时随机测试密码，不可提交或分享；按 Enter 关闭服务并清理。浏览器统一使用 ego-browser。不要指向既有商城数据库。

实际通过：浏览器输入 shared + a / shared + b，真实 HTTP200、业务200，user_info.tenant_id分别为1/2；bravo 留空编码返回租户2；missing 编码返回 HTTP200、业务400“账号或密码错误”。真实登录使用指定服务端路由/控制器/JWT和隔离数据库。

Fixtures：仅登录展示配置 `login/info` 由本机代理提供（标题、轮播默认值、初始 captcha=0），数据库为服务端最小 seed；非完整安装。登录后 get_workerman_url 返回200，但 menus 返回404，最终导航回登录页，因此完整后台会话验收**未通过**，不能归因为本轮代码或宣称已解决。连续错误后页面进入验证码流程，验证码服务及拖动通过未验证。

ego-browser截图覆盖375/768/1280×800输入布局，无横向溢出，错误提示完整。错误图以2倍像素输出（2560×1600）；独立视觉检查已通过此限定范围。保留原375px租户列表遗留项。

## 限制与交接

未完成完整安装商城、跨标签真实延迟响应、验证码服务、双客户端、订单支付库存、队列、PHP8.1或线上验收。此前暂停的服务端独立审查及后台同步任务没有重试，也不计为本轮完成。没有触碰既有商城数据、迁移、合并或部署。

测试启动器首轮库名不符合隔离规则而失败；第二轮标准输入生命周期导致测试HTTP提前退出，浏览器收到502。均作为测试环境失败记录，未计入业务通过；随后采用停止文件与明确输入关闭流程重新验证。构建存在既有包体积警告，不表示全站性能/WCAG通过。
