## CRMEB Taro C 端小程序

该目录是基于现有 `template/uni-app` 页面和 API 约定新增的 Taro 版本，使用 React + TypeScript，同时支持微信小程序和 H5/Web。

### 页面与迁移边界

- 首页：轮播、快捷入口、推荐位（`src/pages/index`）
- 分类：真实父子分类、关键词搜索、商品分页、空态及失败重试（`src/pages/goods`）
- 购物车：按规格选择、全选、库存数量限制、确认删除及选中商品结算（`src/pages/cart`）
- 个人中心：游客/已登录状态、资料重试、手机号绑定、按状态查看订单及服务菜单（`src/pages/user`）
- 请求层：`src/services/api.ts`，通过 `TARO_API_BASE_URL` 配置后端地址

### 运行

在本目录安装依赖后执行：

- 微信小程序：`pnpm dev:weapp` / `pnpm build:weapp`
- H5：`pnpm dev:h5` / `pnpm build:h5`（默认使用 hash 路由，静态资源从 `/` 加载）

环境变量在构建时注入：

- `TARO_API_BASE_URL`：后端 API 根地址，默认使用本地 CRMEB 服务的 `http://127.0.0.1:8080/api`。接入其他服务时，通过此变量替换为你的完整 API 地址，并确保服务端允许 H5 跨域访问。
- `TARO_IMAGE_CDN`：相对图片资源的 CDN 根地址。
- `TARO_IMAGE_HOSTS`：允许的远程图片 host 列表（逗号分隔），继续用于 DIY 远程图片白名单。

平台差异：H5 复用请求层、Storage、页面路由和核心商品/购物车/订单查询链路；微信登录、手机号绑定、微信支付、扫码核销依赖小程序运行时，在 H5 会显示明确的降级提示。H5 分享使用浏览器原生分享能力（如需接入微信 JS-SDK 或支付宝支付，请由服务端下发并在业务层联调）。

业务页面可继续按 uni-app 对应页面迁移，公共组件建议放入 `src/components`。

### 验证与边界

- `pnpm typecheck`、`pnpm test:unit` 检查类型和关键业务回归；`tests/shopping.test.ts` 覆盖分类查询协议、购物车规格隔离、库存限制和选中结算。
- `pnpm build:h5`、`pnpm build:weapp` 均包含包体预算检查；两种构建共用 `dist`，需分别执行。
- 购物车当前保存在本机 Storage，尚未同步服务端购物车；结算价格与库存仍需服务端校验。
- 商品图片不可用时显示占位。微信登录、手机号绑定和支付需在微信环境完成真机联调。
