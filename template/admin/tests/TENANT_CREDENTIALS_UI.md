# LSIT-21 后台凭据接入

联调依赖：PR #45，提交 `2fb18ecbbff769bc77f0aef62d420802f9cb7a93`。后台分支从该提交创建；PR 以 `agent/lsit-21-server` 为 base，仅包含后台改动。服务端合并后由集成人员核对 base 与差异，不直接合并本 PR。

## 行为与接口交接

- 普通管理员从右上角账户菜单的「租户接口凭据」进入，目标为账号的 `tenant_id`，不依赖租户管理菜单；普通管理员直接访问管理页也不加载租户列表。
- 超级管理员严格按 `level=0`（兼容字符串 `"0"`）判断；可从租户列表的「接口凭据」管理指定租户，账户入口管理当前租户。
- 复用 `Authori-zation: Bearer` 请求封装，调用 `GET/POST /adminapi/tenant/credentials/:id` 与 `POST /adminapi/tenant/credentials/:id/reset`。没有新增或变更服务端接口。
- `client_id` 为规范字段，界面注明 `app_id` 同值。只读查询不保留返回中的额外字段；密钥只保存于弹窗组件内存，不进入 Vuex、localStorage、sessionStorage、URL 或日志。
- 首次生成与重置提交期间禁用重复提交；重置先确认旧密钥和租户令牌立即失效。生成/重置成功时展示一次，关闭后无法查回。关闭、组件销毁、路由/账号/租户变化清除密钥，迟到请求不能恢复旧值。
- 提交失败或 409 后要求先重新查询，避免网络不确定时自动生成/轮换。若后台已经成功但未收到密钥，管理员需重新查询后主动确认重置。

## 本地命令

使用 Node 22.19.0。本次复用现有 pnpm 安装目录；未安装依赖或更改锁文件。复用时需设置 `NODE_PATH` 指向该安装的 `node_modules/.pnpm/node_modules`，供 Babel preset 和 ESLint 共享配置解析。标准独立安装使用仓库 CI 的 `pnpm install --frozen-lockfile`。

在 `template/admin/` 执行：

```sh
node --test tests/tenant-credentials.test.cjs
node node_modules/eslint/bin/eslint.js --no-ignore src/api/tenant.js src/components/tenantCredentials/index.vue src/layout/navBars/breadcrumb/user.vue src/pages/system/tenant/index.vue src/pages/account/login/index.vue
NODE_OPTIONS='--openssl-legacy-provider --max-old-space-size=6144' node node_modules/@vue/cli-service/bin/vue-cli-service.js build --mode=production
test -s dist/index.html
git diff --check
```

测试覆盖生成、重置取消/确认、重复提交、409、网络错误、关闭/销毁、迟到响应、目标切换、全局上下文变化、同租户换账号、查询不保留 secret 与真实模板编译。测试不启动数据库。

## 浏览器契约模拟

```sh
node tests/serve-tenant-ui.cjs
```

服务仅绑定 `127.0.0.1:18121`，加载实际生产 `dist`，API 为内存 fixtures，不转发到任何商城或数据库。结束用 Ctrl-C 停止；无需后台常驻。

- 地址：`http://127.0.0.1:18121/admin/login`。
- 测试用户名 `fixture-super` 为超管，`fixture-tenant` 为普通租户；任意非空密码。这些是模拟标识，不能用于真实服务登录。
- 租户甲 ID=2，乙 ID=3；所有重复字符 client/secret 均为测试数据。
- 用 ego-browser 填写登录表单；普通管理员检查账户入口及直接访问 `/admin/system/tenant` 的限制。超管检查租户列表及乙租户操作。
- 验证未生成、生成成功、关闭重开、取消/确认重置、一次性展示、Escape、刷新、查询错误恢复；检查请求记录 `/__qa/events`（仅路径/方法/角色，无密钥）与 storage。
- 375/768/1280px 检查凭据弹窗。现有后台在跨越布局断点时可能重建导航组件，弹窗随之销毁并清除密钥；请在固定窗口完成保存。
- 通过 POST `/__qa/fail` 的 `{ "status": 409 }` 等数据模拟下一次凭据请求的错误响应。仅用于前端错误状态，不证明后端权限正确。

## 非作者服务端只读审查

PR #45 的凭据路由单独进行管理员认证；`TenantAccess::requireTenant()` 在查询/生成/重置前检查自身租户，`level=0` 可访问任意租户。管理列表、CRUD、状态和切换有平台管理员检查，动态菜单过滤租户管理及权限标识。普通管理员令牌租户与账号所属租户校验一致。GET 不返回 secret，写操作只存摘要、响应 no-store。范围内未发现阻塞代码问题。

既有 `/adminapi/tenant/list` 仍是未登录的公开租户选择列表，返回启用租户 id/name/code；不能把管理列表的拒绝表述为所有租户枚举接口均拒绝。该兼容行为需与产品公开信息策略一并验收。

## 验收边界

组件测试、生产构建和真实浏览器上的 fixtures 不等于已安装商城 HTTP/E2E。未获得已安装指定提交且已建凭据表的隔离环境和两类真实测试账号，因此真实后台登录、菜单下发、跨租户拒绝、重置后的旧 secret/tenant_token 失效仍待集成验证。本次未迁移任何现有数据库，未部署、合并或构建双客户端。未做全站 Lighthouse/WCAG、订单/支付、队列与线上验收。截图随 Multica 交付附件提供，不把运行机器绝对路径当成交付链接。
