## CRMEB Taro C 端小程序

该目录是基于现有 `template/uni-app` 页面和 API 约定新增的 Taro 版本，使用 React + TypeScript，默认编译微信小程序。

### 页面与迁移边界

- 首页：轮播、快捷入口、推荐位（`src/pages/index`）
- 商品：商品列表与 API 请求（`src/pages/goods`）
- 购物车：空态和后续订单流程入口（`src/pages/cart`）
- 个人中心：登录入口、订单/地址/优惠券/客服菜单（`src/pages/user`）
- 请求层：`src/services/api.ts`，通过 `TARO_API_BASE_URL` 配置后端地址

### 运行

在本目录安装依赖后执行 `npm run dev:weapp` 或 `npm run build:weapp`。业务页面可继续按 uni-app 对应页面迁移，公共组件建议放入 `src/components`。
