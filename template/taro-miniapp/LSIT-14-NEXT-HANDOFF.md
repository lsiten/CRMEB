本批仅涉及 Taro（H5、微信小程序），UniApp 与服务端文件不变。

- 优惠券：复用远程资源状态，区分加载、失败/重试、成功空态；重试保留筛选标签。兼容 `pages-extra/coupon`、`pages-extra/user-coupon` 共用入口。
- 足迹：默认关闭 `TARO_VISIT_DELETE_ENABLED`。只有目标服务端完成下述补丁集成与联调后，才可设为 `true` 并分别重新构建 H5/微信。客户端开关不是服务端授权措施。
- 启用后：确认绑定打开弹窗时的登录态，防止切号后误操作；锁定重复提交和关闭。读取完整分页的商品 ID 集合后一次删除，读取失败不执行部分删除，提交失败保留记录供取消核对/重试，成功后重新查询列表。

服务端依赖已定位至本地分支 `agent/agent/lsit-14-304408df6d69`、提交 `8a65637b34f3d71a8fb021fd110b46fcf914d486`；这是磐石工作区自动保存提交，包含额外本地交接文件，不应整提交直接合入。Multica 交接附件提供只含两个服务端文件的 `server-dependency.patch`，由服务端负责人审查集成。该提交未确认远端可取，本客户端 PR 不包含或部署该补丁。

接口契约：

- `GET /api/user/visit_list`，`page/limit=20`，`data.list`，使用 `product_id`，不能传日志 `id`。
- `DELETE /api/user/visit`，JSON `{"ids":[101,102]}`。补丁在控制器固定当前登录 uid、`type=visit` 和 `product_id IN ids`，忽略请求内 uid/type；空数组或缺省不删除，重复/不存在商品兼容成功。正整数列表严格校验，非法整批拒绝。
- 成功 HTTP 200 + `status=200/msg=删除成功`；非法参数 HTTP 200 + `status=400/msg=参数错误`，无必需 data。沿用现有认证及请求层错误处理。
- 优惠券仍为 `GET /api/coupons/user/0`；认证、信封、金额、分页和服务端行为均未更改。

验证命令：`pnpm install --frozen-lockfile`、`pnpm typecheck`、`pnpm test:unit`、`pnpm build:h5`、`pnpm build:weapp`。双端默认关闭构建产物分别通过附件交接；额外以 `TARO_VISIT_DELETE_ENABLED=true TARO_API_BASE_URL=http://127.0.0.1:18415/api pnpm build:h5` 生成仅供模拟 API 浏览器 QA 的构建，不作为可发布包。

未验证与风险：服务端补丁尚未集成/部署，真实 HTTP 鉴权、MySQL、租户范围和微信真机均未联调；本次未重跑磐石的 PHP 测试。H5 模拟接口不构成服务端安全验收，微信构建不代表真机交互通过。大量记录需要逐页读取并一次发送 IDs；并发访问/删除不具备原子快照保证，超时后应先刷新核对再重试。沿用 H5 体积/微信 CSS 顺序构建告警；Lighthouse、UniApp 同屏对照及全量迁移验收未做。未合并、部署或发布。
