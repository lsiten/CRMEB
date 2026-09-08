本批仅修改 Taro，覆盖 H5 与微信小程序代码。服务端、UniApp、足迹删除默认关闭策略不变。以 PR #40 的 `5449299d4` 为基线；运行目录含历史自动归档且与 PR 分叉，因此在独立工作树实施，更新 PR 时只快进远端分支。

## 契约与交接

沿用请求层 `/api` 根路径、`Authori-zation: Bearer`、平台 `Form-type` 与 `status/msg/data` 信封；业务失败不当作空数据或成功。金额为元，允许字符串和数字；页面展示服务端金额，加购及创建不提交客户端价格。无新增或改名接口。

| 操作 | 既有契约 | 实现位置与依据 |
| --- | --- | --- |
| 查找已有团 | `GET combination/detail/:activityId` 的 `pink[]`，`id/nickname/count/stop_time` | `StoreCombinationServices::combinationDetail` → `StorePinkServices::getPinkList`，非分页列表 |
| 查看/加入团 | `GET combination/pink/:pinkId`，读取 `pinkT`、`store_combination.productValue`、`count/userBool/is_ok/pinkBool/current_pink_order` | `StoreCombinationServices::getPinkInfo`；退款换团后以返回的团长 `pinkT.id` 为准。已加入、已完成、过期、满团或未知状态不能购买 |
| 参团下单 | `POST cart/add` 的 `productId/cartNum=1/uniqueId/combinationId/new=1`；返回 `cartId`。确认后 `pinkId` 传入 `order/computed/:key` 和 `order/create/:key` | UniApp `goods_combination_status::goPay`、`order_confirm`；`StoreOrderController::computed/create`。旧加购层已有 `pinkId=0` 字段保持兼容，参团身份以订单阶段传参为准 |
| 砍价详情 | `GET bargain/detail/:id?bargainUid=:ownerUid`，`bargain/userInfo/userBargainInfo` | `StoreBargainServices::getBargain`、`StoreBargainUserServices::helpCount`。无 owner 的列表入口先获取当前 uid，再显式查询自己的进度；不会将0当作已确认的发起人 |
| 发起/助力 | `POST bargain/start {bargainId}`；`POST bargain/help {bargainId,bargainUserUid}`；返回 `data.price` 为本次砍掉金额 | UniApp `setBargain/setBargainHelp`，`StoreBargainController::start/help`；成功后重新读取状态，不自行扣减价格 |
| 砍价购买 | `POST cart/add {productId,bargainId,cartNum:1,uniqueId:'',new:1}`，返回 `cartId` 后进入现有确认、创建、收银台 | UniApp `goods_bargain_details::goPay`，`StoreBargainServices::checkBargainStock/checkBargainUser`；服务端选择砍价 SKU、核验当前 uid 和底价资格 |

砍价 `bargainType`：1发起、2邀请、3帮好友、4好友完成、5已帮过、6购买。仅自己的类型6且 `status=1/剩余金额=0` 展示购买；未知或矛盾状态保留刷新入口。`bargain.price` 为当前商品金额，`userBargainInfo.price` 为剩余待砍金额，`alreadyPrice` 为累计已砍金额，不能混用。库存额度及原商品上下架状态来自详情。

砍价链接保留 `bargain` 发起人 UID（兼容 `bargainUid` 输入）。H5复制完整助力链接，微信使用原生分享入口。已有 `goods-bargain-details`、`goods-combination-status` 别名接入对应交易页。

## 交互与验证边界

沿用 DESIGN.md 的 order-management 白卡、750PX 最大容器、14PX 正文、12PX 辅助和44PX按钮，没有新增样式令牌或动画。包含加载、失败刷新、游客、未知状态、缺货、已助力、团已完成/过期/已加入。单次提交使用 ref 锁；读写结果绑定 token 与页面代次，隐藏/卸载后不展示旧反馈或导航。发起/助力失败先刷新核对，避免未知结果直接重复提交。

关键回归覆盖请求/金额语义、砍价状态映射、无效标识、业务错误、重复提交、账号切换/退出、隐藏未卸载、失败后刷新，以及 `pinkId` 从入口到订单计算/创建的保留。H5浏览器使用隔离模拟API验证发起→邀请、助力→已助力、购买→确认→收银台，参团→创建→模拟余额支付成功查询；不等于真实交易验收。

真实后端的库存/限购/重复参与与并发成团、微信真机登录/手机号/分享/支付、UniApp同屏对照和Lighthouse未验证。微信构建使用默认本地API，必须配置目标地址重建；H5使用同源 `/api`。客户端的团状态和库存检查只是即时快照，不能替代服务端原子校验，支付前后的并发变化需要目标环境重点联调。现有通用结算页的下单回调尚未统一绑定账号与页面代次，本批增强的是活动入口及其状态读写，通用结算层需另行完善。构建成功不代表其他端或线上通过。

未加入额外的砍价取消、参与记录/助力名单、海报或会员开通支付流程；仍沿用原有入口范围。路由中声明的 `bargain/help/price`、`help/count` 在当前控制器未发现对应方法，本批不调用；金额与进度全部使用已核实的详情接口。整体 LSIT-14 仍在持续补齐，未合并、部署或发布。
