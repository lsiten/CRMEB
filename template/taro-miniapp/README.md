## CRMEB Taro C 端小程序

该目录是基于现有 `template/uni-app` 页面和 API 约定新增的 Taro 版本，使用 React + TypeScript，同时支持微信小程序和 H5/Web。

### 页面与迁移边界

- 首页：轮播、快捷入口、推荐位（`src/pages/index`）
- 商品：商品列表与 API 请求（`src/pages/goods`）
- 购物车：空态和后续订单流程入口（`src/pages/cart`）
- 个人中心：登录入口、订单/地址/优惠券/客服菜单（`src/pages/user`）
- 请求层：`src/services/api.ts`，通过 `TARO_API_BASE_URL` 配置后端地址

### 运行

在本目录安装依赖后执行：

- 微信小程序：`pnpm dev:weapp` / `pnpm build:weapp`
- H5：`pnpm dev:h5` / `pnpm build:h5`（默认使用 hash 路由，静态资源从 `/` 加载）

环境变量在构建时注入：

- `TARO_API_BASE_URL`：后端 API 根地址，默认 `http://localhost/api`。H5 开发时建议配置为可从浏览器访问的完整地址，并在服务端开启 CORS。
- `TARO_IMAGE_HOSTS`：允许的远程图片 host 列表（逗号分隔）。

平台差异：H5 复用请求层、Storage、页面路由和核心商品/购物车/订单查询链路；微信登录、手机号绑定、微信支付、扫码核销依赖小程序运行时，在 H5 会显示明确的降级提示。H5 分享使用浏览器原生分享能力（如需接入微信 JS-SDK 或支付宝支付，请由服务端下发并在业务层联调）。

业务页面可继续按 uni-app 对应页面迁移，公共组件建议放入 `src/components`。
