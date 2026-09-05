## 跨端核心链路验收矩阵

矩阵以 `template/taro-miniapp`（Taro/微信小程序）为被测端，`template/uni-app` 为对照端。单元测试运行在无后端环境；冒烟测试需要配置同一套测试账号、商品和支付沙箱。

| 链路 | Taro 页面/服务 | uni-app 页面/接口 | 正向验收 | 失败与恢复验收 |
| --- | --- | --- | --- | --- |
| 登录 | `pages/user/index.tsx`、`services/account.ts` | `pages/login`、`libs/login.js`、`api/user.js` | 微信授权成功后保存 token，拉取用户资料 | 拒绝授权可重试；`401` 清 token 并回登录；超时/断网提示可重试 |
| 商品 | `pages/goods/index.tsx`、`pages/goods/detail.tsx`、`services/api.ts` | `pages/goods`、`pages/goods_details`、`api/store.js` | 列表、搜索、详情、库存、规格与购物车一致 | 空列表可刷新；非法商品记录被丢弃；接口错误码不展示脏数据 |
| 下单 | `pages/order/confirm.tsx`、`services/api.ts` | `pages/order_confirm`、`api/order.js` | 地址、配送/自提、活动参数正确提交并生成订单 | 未登录/空购物车不可提交；库存不足和业务错误保留页面状态 |
| 支付 | `pages/order/pay.tsx`、`requestPayment/queryPayment` | `pages/order_pay`、`libs/order.js` | 发起支付、轮询并进入订单详情 | 用户取消支付可重试；支付失败可重试；弱网轮询可退出且不重复下单 |
| 售后 | `pages/order/detail.tsx`、`requestRefund` | `pages/order_detail`、`api/order.js` | 已支付/配送中/已完成订单可申请退款 | 已取消/退款中不可重复申请；接口错误码展示可理解提示 |

### 自动化门禁

在 `template/taro-miniapp` 执行：

```bash
pnpm install
pnpm typecheck
pnpm test:unit
```

单测分层如下：

- API 单测：`tests/api.test.ts` 覆盖旧版 `data/list` 包装、非法记录、分页边界和 `401` 类型错误。
- 状态单测：`tests/state.test.ts` 覆盖登录失效、加载/成功/错误状态、空购物车、支付取消/失败、售后资格。
- 组件单测：`tests/components.test.tsx` 覆盖 Loading/Empty/Modal 的可访问性、空态操作和隐藏/关闭行为。

### 跨端冒烟记录

每次发布候选版本，使用同一账号和商品数据分别运行 Taro 与 uni-app，记录设备、网络（Wi-Fi/弱网）、构建号、接口响应码和结果。以下场景必须各执行一次：授权拒绝、token 失效、商品接口错误码、断网重试、库存不足、支付取消、支付失败、退款重复提交。任何一项失败时保留请求路径、脱敏响应码和截图，不记录 token、手机号或支付参数。
