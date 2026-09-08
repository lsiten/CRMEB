# 可选租户编码与切换响应回归

后台 PR #49 叠加 PR #46；本次 loading 修复基于 `7d19e60eddde87bb023b40ea940b282eee50f168`。唯一修改范围 `template/admin/`，真实服务端固定 `eeba816734253d0d11b9d8324429bfcaa9b2a6ae`，未同步或改动服务端源码。

## 行为与接口

- 登录可选 `tenant_code` 最长64字符，trim 后非空才提交；空值省略，保留 account/pwd/key/captchaType/captchaVerification。错误编码不自动重试其他租户，验证码原流程保留。
- 列表及切换请求分离 loading 归属与业务写入检查：同一生命周期内旧 cookie 请求结束自身 loading；关闭、换账号、导航、销毁会增加版本，旧请求不能清除新请求 loading。业务状态、cookie、菜单、错误提示和刷新仍检查版本、账号、token、超级管理员身份。
- loading 阻止同类请求重入；版本失效时统一释放旧 loading，随后新请求归属新版本。切换成功轮换 token 后更新本请求上下文，再校验异步菜单。
- Message 最大宽度为视口减32px，长错误文本可换行、图标不压缩。无后端响应、认证、分页、金额或客户端契约变化。

## 回归命令及证据

Node 22.19.0，复用已有依赖（本轮 node_modules 为指向既有安装的临时链接），未安装或改锁文件：

```sh
node --test tests/tenant-credentials.test.cjs tests/tenant-switch.test.cjs tests/tenant-login.test.cjs
NODE_PATH=<已有node_modules/.pnpm/node_modules> node node_modules/eslint/bin/eslint.js --no-ignore src/layout/navBars/breadcrumb/user.vue
NODE_PATH=<已有node_modules/.pnpm/node_modules> NODE_OPTIONS='--openssl-legacy-provider --max-old-space-size=6144' node node_modules/@vue/cli-service/bin/vue-cli-service.js build --mode=production
test -s dist/index.html
git diff --check
```

原28项加8项回归，共36项通过。新增回归来自审查 loading 探针：cookie 变化后的列表/切换成功和失败收尾4项在原版失败；关闭重开后真实第二个 deferred 请求仍保持 loading，旧请求成功/失败均不干扰。测试使用真实 Vue 实例与 deferred API，断言新请求调用次数、新 cookie 保留及无旧写入，不替代浏览器 E2E。

## 登录专用启动器的边界

```sh
ADMIN_LOGIN_SERVER=<上述准确SHA的干净checkout> node tests/serve-login.cjs
```

该入口仅用于登录，不是完整后台：`serve-login.php` → `admin_login_fixture.php` → `admin_login_router.php` 只加载 route.php、tenant.php、setting.php，**没有加载定义 menus 的 common.php**。前端 `/adminapi/menus` URL 正确，该环境404不作为已确认产品路由缺陷。

最小 seed 只有5个后台表的DDL和一条 setting/info 权限等测试数据，没有正式菜单、角色初始化。只补 common.php 后 menus 返回200但为空，空权限仍会使前端回登录。旧启动器还为 `login/info` 提供展示 fixtures；其结果不可外推真实配置接口或完整后台验收。

## 本轮真实双标签隔离准备

沿用审查报告的真实 common.php/正式菜单准备方式。本轮可复现脚本随 issue 证据附件提供（session-runner.cjs、session-driver.php、session-router.php），全部在后台测试目录之外置工作区运行，未编辑 crmeb/：

1. 精确服务端 checkout；使用 PHP7.4 和本机 MySQL 二进制，随机独占端口及新 datadir，不连接3306或既有商城库。新库匹配 `lsit21_test_[a-f0-9]+`，缓存单独文件目录。
2. 导入完整 `public/install/crmeb.sql`。仅内存中的导入副本将 ROW_FORMAT=COMPACT 改为 DYNAMIC，连接 SESSION sql_mode 设为 NO_ENGINE_SUBSTITUTION，以复用上轮 MySQL8 的兼容准备；原 SQL 文件不改。
3. 在新库执行原始 tenant_migration.sql（执行前去除客户端 DELIMITER 指令）及 upgrade/tenant_credentials.sql。初始化A/a、B/b两租户；新随机密码只在运行时0600 ready文件中保存。创建 platform 超管及 shared 两租户同名、bravo唯一测试账号；普通测试角色权限取安装菜单ID集合，不代表生产角色配置。
4. 外置 router 求值原 `admin_login_router.php`，保持原路径解析，仅在 dispatch 前加载真实 `app/adminapi/route/common.php`。这仍跳过正式安装初始化/事件/部分配置，不是 public/index.php 完整验收环境。
5. 外置代理提供当前后台 dist，透传全部 adminapi，包括真实 login/info、menus，不造菜单或配置响应。测试控制文件存在时只将真实 tenant/switch 响应延迟7000ms，内容保持原样；日志只记录时间、方法、路径、HTTP/业务状态。
6. 使用 ego-browser 同一空间两标签，通过实际表单登录。第一标签正常A→B作为对照；本轮有效竞态在A发起切B、确认 busy=true 后，第二标签再次实际登录platform，确认共享cookie变化。旧响应结束后第一标签 busy=false/current=1/version=0，新cookie保持；再次点击B有1个新 POST tenant/switch，HTTP200/业务200，结束 current=2/busy=false。

本轮首次尝试未真正发出延迟请求，未计为通过；以上为重跑的明确 pending/请求日志证据。Vue内部状态只用于观察，未手写cookie或调用组件方法代替登录/切换。375/768/1280×800新截图显示真实 JSON 错误toast换行完整，未见横向裁切；不再沿用旧“错误提示完整”的过度结论。

## 已记录的环境失败与归属

| 请求/现象 | 本轮实际结果 | 归属与限制 |
| --- | --- | --- |
| GET /adminapi/login/info | HTTP200、非JSON；浏览器显示 SyntaxError | 服务端 Login::info → getLoginInfo；隔离路由器未加载完整初始化，PHP日志 Unable to resolve NULL driver for think\\Log。尚不能判定正式环境产品缺陷，服务端初始化链需磐石联查。 |
| GET /adminapi/custom_admin_js、/home/order、/home/user | HTTP200、非JSON | 服务端/诊断初始化范围，记录路径后未扩写页面或改服务端。 |
| /statics/system_images/admin_logo_small.png | 后台logo破图 | 正式静态资源路径，测试代理仅提供dist，缺失静态资源回落HTML；部署/测试静态映射边界，未改业务logo。 |
| 账户头像 img src="" | 无图片请求、破图 | 随机seed账号未初始化 head_pic；记录数据及账户组件边界，未扩写账户页面。 |
| 长连接未开启通知 | 正常提示但遮挡菜单，点击关闭后可操作 | 本轮没有启动 Workerman，不代表消息/客服通过。 |

仅管理后台 Web 本次 loading 场景和错误toast增量验证。完整安装商城、验证码拖动通过、375px租户列表、订单支付库存、队列、双客户端/真机、PHP8.1、全站性能/WCAG和线上均未验收。此前暂停的独立服务端审查及后台同步未重试、不计完成。

收尾通过启动器Enter正常停止并删除独立数据库/datadir/cache/ready文件，关闭专属ego空间，核对端口无监听；保留脱敏日志和截图附件。不合并、不部署、不迁移既有环境。构建有既有包体积警告。
