# Taro / uni 全量差距清单

核对日期：2026-09-06。以仓库 uni-app 和 PHP API 为功能契约，保留平台条件差异；不把通用营销页或同名入口视为完整迁移。

基线：类型检查通过，15 个测试文件 / 104 项单测通过。台账是全量路由初审，逐项业务和视觉验收仍在进行；测试通过不等于完整迁移完成。

## 全量路由台账

从 uni `pages.json` 主包和所有分包提取，共 126 个注册页面。状态“部分”表示有相关实现但尚未实现/验证完整等价；“待验证”不代表验收通过。Taro 路径为相关实现位置，并不保证一对一等价。

| uni 路由 | 模块 | Taro 相关实现 | 状态 | 差距/验收范围 |
| --- | --- | --- | --- | --- |
| `pages/guide/index` | 启动引导 | — | 缺失 | 平台条件引导、首次启动与协议流程需核对 |
| `pages/index/index` | 首页 | pages/index/index | 部分 | 已有DIY渲染；需全部组件配置、导航参数、微页面及分享逐项对照 |
| `pages/order_addcart/order_addcart` | 购物车 | pages/cart/index | 部分 | 已接服务端列表/数量/删除及失效记录；仍需规格更换、批量管理、登录合并与更多状态验收 |
| `pages/user/index` | 个人中心 | pages/user/index | 部分 | 已有基础菜单；需DIY布局、真实统计、会员/资产/管理入口 |
| `pages/goods_cate/goods_cate` | 分类与商品列表 | pages/goods/index | 部分 | 需排序/筛选、活动筛选、版式切换、热新品与反馈 |
| `pages/goods_details/index` | 商品详情 | pages/detail/index | 部分 | 需真实 storeInfo/productAttr/productValue、规格库存、活动/优惠/评价、分享 |
| `pages/extension/customer_list/chat` | 客服 | pages-extra/customer/index | 部分 | 发送方法直接抛错；缺实时连接、发送/重连、图片和商品/订单消息 |
| `pages/extension/news_list/index` | 资讯 | pages/news/index、pages-extra/news-detail/index | 部分 | 需逐项核对分类、分页、富文本/视频、分享与加载失败 |
| `pages/extension/news_details/index` | 资讯 | pages/news/index、pages-extra/news-detail/index | 部分 | 需逐项核对分类、分页、富文本/视频、分享与加载失败 |
| `pages/goods/goods_list/index` | 分类与商品列表 | pages/goods/index | 部分 | 需排序/筛选、活动筛选、版式切换、热新品与反馈 |
| `pages/goods/goods_search/index` | 搜索 | pages/search/index | 部分 | 需核对热门词/历史词、删除确认、结果与空态 |
| `pages/goods/order_pay_status/index` | 支付结果 | pages/order/pay | 部分 | 已有服务端支付成功/待支付状态与订单入口；仍缺独立结果布局、推荐和特殊订单分流 |
| `pages/goods/admin_order_detail/index` | 订单 | pages/order/list、detail | 部分 | 接口与真实后端不匹配；缺全部状态、分页、收货/删除/再买/评价 |
| `pages/goods/goods_comment_con/index` | 商品评价 | pages/order/review | 部分 | 已接订单商品 unique、商品/服务评分、文字和最多8张图片、失败保留重试、成功返回订单；已接评价抽奖入口与实物领奖基础流程；已接红包确认领取基础流程；待完整视觉对照与真机验收 |
| `pages/goods/goods_comment_con/lottery_comment` | 抽奖 | pages/marketing/review-lottery | 部分 | 已接类型4资格、服务端次数/结果、重复点击保护、不确定结果核对、实物地址领取和红包入口；已复用顺时针九宫格转动、减少动画、结果弹层，补返回首页；待uni完整装饰/头部、视觉与真机 |
| `pages/goods/goods_comment_list/index` | 商品评价 | pages-extra/reviews/index?product_id= | 部分 | 已接真实统计、四档筛选/分页、图片预览、会员/规格/时间与商家回复，商品详情入口及错误重试；待uni同屏视觉、真机与真实数据联调 |
| `pages/goods/goods_details_store/index` | 门店 | pages-extra/store/index | 部分 | 需核对门店选择回传、距离/定位、电话、营业时间 |
| `pages/goods/goods_logistics/index` | 物流 | pages/order/logistics | 部分 | 已接真实物流事件接口与失败重试；待补快递公司/单号、复制、退货物流追踪与同屏对照 |
| `pages/goods/goods_return/index` | 售后 | pages/order/refund-apply | 部分 | 已接商品数量/原因/说明、资格核验、仅退款/退货退款、防重与失败保留；已补最多3张凭证上传/预览/移除；待完整边界与真机验收 |
| `pages/goods/goods_return_list/index` | 售后 | pages/order/refund-apply | 部分 | 已接服务端可退商品与剩余数量、多商品选择；待多商品真实拆单边界与uni同屏对照 |
| `pages/goods/lottery/grids/index` | 抽奖 | pages/marketing/lottery | 部分 | 已接1–5类资格/指定活动、服务端次数与结果、九宫格转动/减少动画、规则/中奖播报/个人奖品、关注弹层、实物表单和红包记录入口；已接邀请生成/H5复制及游客登录返回、小程序按钮回调；已接H5微信菜单签名/失败重试；已接小程序顶部好友菜单准备/返回刷新及账号检查；待原生菜单展示/发送验收、uni完整视觉及真机 |
| `pages/goods/lottery/grids/record` | 抽奖 | pages/marketing/lottery-records | 部分 | 已接分页、失败重试、实物补领和快递信息/复制；红包状态与微信确认领取入口/SDK已接线；待真实渠道及完整视觉 |
| `pages/goods/order_confirm/index` | 结算 | pages/order/confirm | 部分 | 普通商品真实确认/计价/创建、优惠券/积分/备注/自提已接通；仍需发票、虚拟/自定义/赠礼/活动流程及全状态验收 |
| `pages/goods/order_details/index` | 订单 | pages/order/detail、refund-detail | 部分 | 已接真实详情、取消/收货/删除/再次购买、售后入口和错误恢复；已补逐商品评价入口与已评价状态；待拆单/礼品/虚拟订单细节、完整视觉对齐 |
| `pages/goods/order_list/index` | 订单 | pages/order/list | 部分 | 已接数值状态筛选（含待评价）、分页去重与失败重试、售后入口；待各状态动作与uni同屏对照 |
| `pages/goods/order_refund_goods/index` | 售后 | pages/order/refund-detail | 部分 | 已接商家退货地址、快递选择/单号/手机号提交与状态刷新；隔离交互走通，待真实渠道与退货物流轨迹 |
| `pages/goods/receive_gifts_status/index` | 特殊支付与赠礼 | — | 缺失 | 收银台、代付详情与结果、礼物领取、线下付款、支付宝回跳 |
| `pages/goods/receive_gift/index` | 特殊支付与赠礼 | — | 缺失 | 收银台、代付详情与结果、礼物领取、线下付款、支付宝回跳 |
| `pages/goods/cashier/index` | 收银台 | pages/order/pay | 部分 | 已接后端金额/支付开关、支付请求、状态确认与失败恢复；真实渠道/真机、代付及特殊订单仍待验收 |
| `pages/users/user_vip_areer/index` | 会员 | pages/marketing/index?kind=member | 部分 | 通用活动页不能等同会员；缺权益、成长、购买/激活、会员券与协议 |
| `pages/users/privacy/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/user_cancellation/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/message_center/index` | 消息 | pages-extra/messages/index | 部分 | 需独立详情、类型筛选、分页、阅读与删除操作契约核对 |
| `pages/users/message_center/messageDetail` | 消息 | pages-extra/messages/index | 部分 | 需独立详情、类型筛选、分页、阅读与删除操作契约核对 |
| `pages/users/user_invoice_order/index` | 发票 | — | 缺失 | 抬头列表/编辑、订单开票、发票详情与下载 |
| `pages/users/scan_login/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/user_invoice_list/index` | 发票 | — | 缺失 | 抬头列表/编辑、订单开票、发票详情与下载 |
| `pages/users/user_invoice_form/index` | 发票 | — | 缺失 | 抬头列表/编辑、订单开票、发票详情与下载 |
| `pages/users/alipay_invoke/index` | 特殊支付与赠礼 | — | 缺失 | 收银台、代付详情与结果、礼物领取、线下付款、支付宝回跳 |
| `pages/users/wechat_login/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/binding_phone/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/retrievePassword/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/user_info/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/user_get_coupon/index` | 优惠券 | pages-extra/coupon/index、pages/marketing/index?kind=coupon | 部分 | 需可用/已用/过期筛选、分页、适用商品/使用入口 |
| `pages/users/visit_list/index` | 足迹 | — | 缺失 | 浏览记录、按日分组、分页与清空/删除 |
| `pages/users/user_goods_collection/index` | 收藏 | pages-extra/favorites/index | 部分 | 需核对远端列表/分页、取消收藏与失效商品 |
| `pages/users/user_sgin/index` | 签到 | pages/marketing/index?kind=sign | 部分 | 缺完整连续签到展示、日历、奖励说明和签到记录页 |
| `pages/users/user_sgin_list/index` | 签到 | pages/marketing/index?kind=sign | 部分 | 缺完整连续签到展示、日历、奖励说明和签到记录页 |
| `pages/users/user_money/index` | 资产 | pages-extra/assets/index、pages/integral/records | 部分 | 缺充值金额/赠送、支付、账单分类分页；需金额正负与冻结资金展示 |
| `pages/users/user_bill/index` | 资产 | pages-extra/assets/index、pages/integral/records | 部分 | 缺充值金额/赠送、支付、账单分类分页；需金额正负与冻结资金展示 |
| `pages/users/user_integral/index` | 资产 | pages-extra/assets/index、pages/integral/records | 部分 | 缺充值金额/赠送、支付、账单分类分页；需金额正负与冻结资金展示 |
| `pages/users/user_coupon/index` | 优惠券 | pages-extra/coupon/index、pages/marketing/index?kind=coupon | 部分 | 需可用/已用/过期筛选、分页、适用商品/使用入口 |
| `pages/users/user_spread_user/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/user_spread_code/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/user_spread_money/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/user_spread_money/receiving` | 微信收款 | pages/account/merchant-transfer | 部分 | 已接transfer/info、服务端金额/状态、微信H5与小程序调用、取消/超时/失败恢复、到账核对；待提现记录入口、真实渠道及uni视觉 |
| `pages/users/user_cash/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/user_vip/index` | 个人中心 | pages/user/index | 部分 | 已有基础菜单；需DIY布局、真实统计、会员/资产/管理入口 |
| `pages/users/user_distribution_level/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/user_address_list/index` | 地址 | pages-extra/address/index、pages/account/address-editor | 待验证 | 已有手工编辑/平台导入；需真实地区数据、默认地址与结算回传验证 |
| `pages/users/user_address/index` | 地址 | pages-extra/address/index、pages/account/address-editor | 待验证 | 已有手工编辑/平台导入；需真实地区数据、默认地址与结算回传验证 |
| `pages/users/user_phone/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/user_payment/index` | 资产 | pages-extra/assets/index、pages/integral/records | 部分 | 缺充值金额/赠送、支付、账单分类分页；需金额正负与冻结资金展示 |
| `pages/users/user_pwd_edit/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/promoter-list/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/promoter-order/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/promoter_rank/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/commission_rank/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/user_return_list/index` | 售后 | pages/order/refunds、refund-detail | 部分 | 已接售后列表/分页/详情、状态区分、撤销/删除；待完整状态浏览器验收与uni同屏对照（申请页已补凭证上传） |
| `pages/users/login/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/users/payment_on_behalf/index` | 特殊支付与赠礼 | — | 缺失 | 收银台、代付详情与结果、礼物领取、线下付款、支付宝回跳 |
| `pages/users/payment_on_behalf/pay_status` | 特殊支付与赠礼 | — | 缺失 | 收银台、代付详情与结果、礼物领取、线下付款、支付宝回跳 |
| `pages/users/staff_list/index` | 分销 | pages-extra/distribution/index | 部分 | 当前仅概览海报；缺推广人/订单、提现表单与记录、排行/等级和员工 |
| `pages/users/auth/index` | 账号 | pages/account/* | 部分 | 已有密码/短信/注册/重置/协议/资料/手机号/注销；扫描登录、微信H5授权等需核对 |
| `pages/activity/goods_bargain/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/activity/goods_bargain_details/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/activity/goods_combination/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/activity/goods_combination_details/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/activity/goods_combination_status/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/activity/goods_seckill/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/activity/goods_seckill_details/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/activity/poster-poster/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/activity/bargain/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/activity/presell/index` | 营销活动 | pages/marketing/index、detail | 部分 | 缺秒杀时段、拼团进度/参团、砍价发起/帮砍、预售定金尾款、海报分享 |
| `pages/admin/distribution/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/distribution/scanning/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/distribution/scanning/detail/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/distribution/orderDetail/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/custom_date/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/order/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/orderList/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/orderDetail/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/delivery/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/refund/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/logistics/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/refund_order_list/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/refund_order_detail/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/goods/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/goods/specs` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/goods/addGoods` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/user/list` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/user/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/statistics/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/admin/order_cancellation/index` | 移动管理端 | — | 缺失 | 订单/退款审核、配送核销、商品规格编辑、用户管理、统计；需要权限和操作闭环 |
| `pages/columnGoods/HotNewGoods/index` | 分类与商品列表 | pages/goods/index | 部分 | 需排序/筛选、活动筛选、版式切换、热新品与反馈 |
| `pages/columnGoods/HotNewGoods/feedback` | 分类与商品列表 | pages/goods/index | 部分 | 需排序/筛选、活动筛选、版式切换、热新品与反馈 |
| `pages/columnGoods/live_list/index` | 直播 | — | 缺失 | 直播列表及平台直播间跳转 |
| `pages/annex/web_view/index` | 附属内容 | — | 缺失 | 外链web-view、专题页、入驻申请与表单校验 |
| `pages/annex/vip_paid/index` | 会员 | pages/marketing/index?kind=member | 部分 | 通用活动页不能等同会员；缺权益、成长、购买/激活、会员券与协议 |
| `pages/annex/vip_coupon/index` | 会员 | pages/marketing/index?kind=member | 部分 | 通用活动页不能等同会员；缺权益、成长、购买/激活、会员券与协议 |
| `pages/annex/vip_clause/index` | 会员 | pages/marketing/index?kind=member | 部分 | 通用活动页不能等同会员；缺权益、成长、购买/激活、会员券与协议 |
| `pages/annex/vip_active/index` | 会员 | pages/marketing/index?kind=member | 部分 | 通用活动页不能等同会员；缺权益、成长、购买/激活、会员券与协议 |
| `pages/annex/offline_pay/index` | 特殊支付与赠礼 | — | 缺失 | 收银台、代付详情与结果、礼物领取、线下付款、支付宝回跳 |
| `pages/annex/offline_result/index` | 特殊支付与赠礼 | — | 缺失 | 收银台、代付详情与结果、礼物领取、线下付款、支付宝回跳 |
| `pages/annex/special/index` | 附属内容 | — | 缺失 | 外链web-view、专题页、入驻申请与表单校验 |
| `pages/annex/settled/index` | 附属内容 | — | 缺失 | 外链web-view、专题页、入驻申请与表单校验 |
| `pages/points_mall/index` | 积分商城 | pages/integral/* | 部分 | 已存在七页；需逐项核对列表、详情规格、确认/地址、结果、订单、物流和记录 |
| `pages/points_mall/integral_goods_list` | 分类与商品列表 | pages/goods/index | 部分 | 需排序/筛选、活动筛选、版式切换、热新品与反馈 |
| `pages/points_mall/integral_goods_details` | 商品详情 | pages/detail/index | 部分 | 需真实 storeInfo/productAttr/productValue、规格库存、活动/优惠/评价、分享 |
| `pages/points_mall/exchange_record` | 积分商城 | pages/integral/* | 部分 | 已存在七页；需逐项核对列表、详情规格、确认/地址、结果、订单、物流和记录 |
| `pages/points_mall/integral_order` | 积分商城 | pages/integral/* | 部分 | 已存在七页；需逐项核对列表、详情规格、确认/地址、结果、订单、物流和记录 |
| `pages/points_mall/user_address` | 积分商城 | pages/integral/* | 部分 | 已存在七页；需逐项核对列表、详情规格、确认/地址、结果、订单、物流和记录 |
| `pages/points_mall/integral_order_status` | 积分商城 | pages/integral/* | 部分 | 已存在七页；需逐项核对列表、详情规格、确认/地址、结果、订单、物流和记录 |
| `pages/points_mall/integral_order_details` | 订单 | pages/order/list、detail | 部分 | 接口与真实后端不匹配；缺全部状态、分页、收货/删除/再买/评价 |
| `pages/points_mall/logistics_details` | 积分商城 | pages/integral/* | 部分 | 已存在七页；需逐项核对列表、详情规格、确认/地址、结果、订单、物流和记录 |
| `subpackage/diyComponents/pages/placeholder` | DIY内部占位 | src/diy | 待验证 | 原版分包组件占位，不作为独立业务页；核对组件集合与加载路径 |

## 修复顺序与验收证据

1. P0 请求/鉴权、商品规格、服务端购物车、确认计价/下单/支付、订单与售后。
2. P1 评价、优惠券、足迹、签到、充值/账单、分销、发票、客服、消息。
3. P1 活动专属流程：秒杀、拼团、砍价、预售、抽奖、赠礼和会员。
4. P2 移动管理端、专题/微页面、直播、入驻、平台专属授权/支付/分享。
5. 按同账号同数据核对页面默认/加载/空/失败/禁用/成功状态，完成H5浏览器和小程序真机验证。

### 已落地

- 请求层已补充 CRMEB `status` 业务码：HTTP 200 中的 401 清理会话并拒绝；400 等业务失败不再流入成功分支。新增契约测试先复现两个失败，再修复。
- 订单列表、详情、取消、物流已改用 `/order/list`、`/order/detail/:uni`、`/order/cancel`、`/order/express/:uni`；解析 `order_id`、`_status`、`cartInfo`、金额、地址和物流包装。6 项契约回归先失败后通过；尚未使用登录账号联调。
- 商品详情直接查询商品 ID，解析 `storeInfo`、`productValue`、`spec_unique`，保留规格价格/库存/唯一标识，商品列表保留零库存；不再从前 50 个商品中查找详情。
- 商品详情新增加载/重试、真实富文本、图片失败占位；移除虚构库存和描述。规格和操作按钮达到 44PX，375/768/1280px 无横向溢出。
- 立即购买使用独立单件草稿，购物车既有数量不变；旧草稿标识不会误取新草稿。结算时通过 `cart/add new=1` 转为服务端临时记录，再确认计价。
- 购物车读取服务端有效/失效记录，以 cartId 更新数量和删除；刷新与修改串行，失败不改写渲染数量。默认购物车页通过隔离数据验证。
- 普通商品结算已串联 `order/confirm`、`order/computed/:key`、`order/create/:key`，支持地址、自提门店及联系人、优惠券、积分和备注。展示服务端计价，乱序报价不会覆盖当前条件；创建超时重试遇到 EXTEND_ORDER 时按确认键读取真实订单号并进入收银台。
- 支付改用真实收银台和 `/order/pay`，请求带平台 `Form-type`，保留返回的新订单号，以订单 paid 字段确认成功；新增取消/失败恢复、有上限的查询。微信 RSA 参数、H5 跳转/微信桥、支付宝 H5 表单和通联 H5/半屏小程序已接线，渠道真机验收仍待进行。
- 核心 `services/api.ts` 已移除 `@ts-nocheck`，修改文件均低于 250 行。

### 尚待落地的核心契约

- 售后已迁移真实 `/order/refund/*` 契约并补齐申请、原因/数量/凭证、列表/详情、撤销/删除及退货物流基础流程；仍需完整状态与边界、拆单关联及真机验收。订单评价已接提交和赠抽奖实物领奖基础流程，红包领取已接基础流程，其他资格与转动交互仍待补齐。
- 支付仍需微信/支付宝/通联商户真实渠道、小程序真机、代付、预售尾款、平台授权返回和支付链接/二维码页面验收。隔离模拟成功不是实际收款证明。
- 普通结算仍待发票、虚拟商品、自定义表单、赠礼和活动专属参数/优惠规则完整对照；部分已有页面接口尚未审核。
- 商品详情还需属性分组、多图/视频、数量与起购量/限购、默认 SKU、参数/保障、优惠券/会员价、评价、分享与活动专属交易；当前增量不代表详情全量完成。
- `sendChatMessage` 未实现发送，不能标记客服完成。
- `@ts-nocheck` 仍存在于部分未修改页面，类型检查通过不覆盖这些代码。

### 本轮验证边界

- 真实 H5 服务：`localhost:10086`；真实本机 PHP API：`127.0.0.1:8080/api`。ego-browser task space 105 用于此长期目标，后续继续复用。
- 真实商品 4 已读取 16 个规格并渲染；远程 demo 图片当前不可用，截图显示真实图片失败占位。截图位于 `.omo/evidence/taro-parity/detail-{375,768,1280}.png`。
- 独立视觉审查通过当前首屏展示增量；没有同尺寸 uni 截图，不声明视觉全量一致。未验证完整富文本滚动、全部功能页、小程序真机授权/支付。
- 原运行中的 H5 服务继续保留；构建产物 H5/微信共用 `dist`，最后一次构建会覆盖上一次产物。
- 第二阶段用户明确选择“先用隔离测试数据验证交互”。独立测试页使用127.0.0.1:10086，所有API响应在该页替换并标记“隔离测试数据”，没有创建真实订单或支付。原开发服务随后发现无监听，已新启动同端口服务；最新默认状态截图在恢复服务后重拍。

### 评价与凭证增量（2026-09-06）

- 订单评价按订单商品 unique 获取商品并提交双评分、文字、最多8张图片；售后申请复用上传组件，限制3张。仅服务端确认的图片URL进入提交内容。
- 隔离浏览器已验证上传失败重试、预览/移除、评价失败保留并重试成功、返回订单显示已评价，以及售后3张上限/移除后提交2张。没有真实上传、评价或售后写入。
- 当前32个测试文件、193项测试及TypeScript检查通过，H5/微信构建和体积门槛通过。33张当前截图覆盖11个状态、375/768/1280宽度。详见 `.omo/evidence/taro-parity/review-upload-verification.md`。
- 此处为当时的增量边界；后续商品评价列表与抽奖进展见下文，uni同屏视觉和小程序真机仍待补齐。

### 商品评价列表增量（2026-09-06）

- 已替换不存在的reply/user契约，接入reply/config/:id与reply/list/:id，商品详情可进入对应评价列表。无商品参数的旧入口引导至待评价订单。
- 已覆盖统计失败重试、全部/好评/中评/差评、分页失败保留20条/重试后22条、加载中、全空、图片预览、商家回复。36张截图覆盖12个状态和3种宽度。
- 200项测试通过，仍未宣称真实API联调成功：本机API本轮返回502，按用户已授权的隔离数据继续验收。详见 `.omo/evidence/taro-parity/product-reviews-verification.md`。

### 评价抽奖与实物领奖增量（2026-09-06）

- 已接评价成功入口、类型4资格/服务端奖品与次数、抽奖结果和网络不确定时禁止直接重试。实物领奖支持已存地址、手工地址、提交失败保留和确认后成功；中奖记录支持补领、快递与单号复制。
- 隔离浏览器覆盖19状态、375/768/1280宽度共57张截图；夹具请求日志保留活动ID与领奖记录ID的区别，无真实抽奖/领奖写入。新19项测试通过，全量219项通过。
- 修正CommerceImage在居中文字父容器中aspectFit图片横向裁切；全部抽奖截图在修复后捕获。独立审查与最终构建记录见 `.omo/evidence/taro-parity/lottery-verification.md`。
- 此增量尚不代表抽奖完整对齐：其他资格、uni转动动画、红包确认领取/SDK、奖品评价、同屏视觉与真机仍需继续实现或验收。

### 微信收款确认增量（2026-09-06）

- 已接红包中奖结果→中奖记录→微信收款页。使用wechat_order_id读取transfer/info，服务端金额/状态决定展示，SDK回调成功不直接宣称到账。
- H5微信桥和小程序requestMerchantTransfer已接线，支持重复点击保护、取消、超时、跨渠道/不支持提示、查询失败保留和刷新、服务端SUCCESS结果。
- 新增26项测试，全量245项通过；隔离浏览器17状态×3宽度51张截图。本次没有真实红包转账；完整渠道/真机和uni同屏仍待验收。最终构建/复审见 `.omo/evidence/taro-parity/transfer-verification.md`。

### 通用抽奖接口基础（2026-09-06）

- 已核实 1–5 类资格、指定活动 ID 优先级、单次积分/余额消耗及公众号关注返回；服务层已实现，原评价资格复用该入口。
- 新增 10 项契约测试，全量 255 项通过，类型检查通过。通用页面、配置显示开关、规则/播报/个人奖品、转动和关注二维码展示仍待实现，不能据此认定通用抽奖对齐。详细依据见 `.omo/evidence/taro-parity/general-lottery-contract.md`。
- 后续已接活动头图/规则及公开、个人中奖列表的数据模型和后台开关，共享抽奖状态支持指定活动、真实资格和公众号关注阶段；全量 260 项测试通过。独立页面和转动仍待实现与浏览器验收。

### 通用抽奖页面增量（2026-09-06）

- 独立页面与旧营销入口已接通，规则/记录遵守后台开关；九宫格以服务端奖品为停点，转动结束再展示结果，支持减少动画、关注提示及不确定结果核对。
- 全量263项测试、类型检查及两项独立审查通过。隔离浏览器45状态截图与9转动帧覆盖375/768/1280，未进行真实扣款。记录见 `.omo/evidence/taro-parity/general-lottery-page-verification.md`。
- 评价专属页仍需复用转动，邀请分享、奖品评价、uni同尺寸展示对照与真机仍未完成，全量目标继续进行。

### 评价抽奖共享转动增量（2026-09-06）

- 评价页已复用顺时针九宫格、服务端停点、减少动画和停止后结果弹层，补齐返回首页并保留返回原订单；错误恢复提示移到棋盘上方。
- 全量266项测试、最终类型检查、小程序/H5构建及两项独立审查通过。隔离浏览器75帧覆盖评价页和通用页回归；临时页已关闭，无真实交易写入。详见 `.omo/evidence/taro-parity/review-motion-verification.md`。
- 邀请分享、奖品评价、uni装饰资源与同尺寸展示、真机验收仍未完成；另需确认并处理两个应用入口导致的推荐人保存逻辑可达性。

### 推荐人应用入口修复（2026-09-06）

- 实际CLI解析器及H5加载模块确认旧app.jsx遮蔽app.tsx。已删除旧入口，推荐人生命周期现在可达；真实隔离落地验证有效参数保存、无效/空参数保留及新推荐人更新。
- 全量267项测试与类型检查通过。记录见 `.omo/evidence/taro-parity/referral-entry-verification.md`。登录请求消费、分享生成、扫码与后端绑定仍待补齐，不将仅存储参数视为推荐链路完成。

### 登录推荐参数增量（2026-09-06）

- 密码/短信登录、注册及既有小程序授权入口已消费经过筛选的推荐参数；spid别名优先级与uni一致，普通用户ID不会冒充二维码记录ID。
- 全量277项测试与类型检查通过，隔离真实浏览器验证三个H5表单请求，无真实账号/交易写入。证据见 `.omo/evidence/taro-parity/login-referral-verification.md`。
- 新发现注册切回账号密码时输入框仍为数字类型，待修复。完整分享、扫码、已登录静默绑定和完整微信授权仍未完成。

### 登录模式输入节点修复（2026-09-06）

- 已修复短信/注册返回账号密码后残留数字类型、手机号提示及11位限制的问题。按模式隔离Taro输入节点，保留表单草稿；注册返回后可正常输入字母账号。
- 全量279项测试、类型检查、两端构建及两项独立审查通过。隔离浏览器7状态×3屏宽共21帧通过，未创建真实账号或登录态。证据见 `.omo/evidence/taro-parity/login-mode-verification.md`。
- 此为登录交互修复，完整uni展示、微信授权与推广绑定链路仍待继续验收。

### 扫码推荐参数增量（2026-09-06）

- 已区分微信场景编号、pid推广用户和二维码记录，覆盖扫码/长按/相册及直接进入；二维码记录通过spread_code交给小程序授权，不混入H5注册推广UID。
- 全量301项测试、类型检查通过，App生命周期模拟验证持久化，真实H5验证普通code参数隔离。详情见 `.omo/evidence/taro-parity/referral-scene-verification.md`。
- 已登录静默绑定、完整分享与微信授权、真机扫码及后端实际推荐关系仍待实现或验收。

### 已登录静默推荐同步（2026-09-06）

- 应用进入与登录完成后已调用user/spread，区分puid/code/agent_id；支持游客保留、失败重试、并发合并、新参数串行和旧响应清理保护。服务器“不绑定”不会被展示成绑定成功。
- 同步验证发现旧401响应清除新登录态的问题，已在共享请求层修复。全量316项测试、类型检查通过；真实隔离浏览器覆盖启动同步与游客登录后同步，无真实推荐写入。
- 记录见 `.omo/evidence/taro-parity/referral-sync-verification.md`。完整分享、微信授权、真机及实际后端关系验收仍待继续。

### 抽奖分享链接基础（2026-09-06）

- 已补齐活动type/lottery_id/spread白名单与链接生成器，使用当前用户UID，移除旧查询/登录参数并保留H5部署路径；缺失信息和切换账号时拒绝生成错误邀请。
- 全量330项测试与类型检查通过。当前生成器尚未接入页面，分享按钮、原生回调、H5微信菜单配置及浏览器/真机验收仍待完成。详见 `.omo/evidence/taro-parity/lottery-share-contract.md`。

### 抽奖差距校正（2026-09-06）

- 复核uni抽奖主页、中奖记录页完整模板/脚本与api/lottery.js，未发现“奖品评价”入口或接口。goods_comment_con/lottery_comment是订单评价完成后的赠抽奖页，并不是奖品评价页。先前增量日志中的“奖品评价待补齐”为误记，已从当前路由台账移除；不新增原版不存在的功能。

### 抽奖邀请交互增量（2026-09-06）

- 分享生成器已接入通用抽奖页，提供邀请、生成中/失败重试、H5链接复制/失败手动复制、关闭和游客登录返回原活动；小程序按钮与元数据回调已接线。
- 修复H5复制结果确认：现代API拒绝和旧execCommand返回false均不会提示成功。50文件339项单测、类型检查、两端构建与预算通过；保留既有构建警告。
- 隔离浏览器16状态×3屏宽48帧，真实模拟登录返回与复制、失败回退通过。动画证据重拍后独立双审查通过，未发送真实邀请或写入真实交易/推荐关系。完整证据见 `.omo/evidence/taro-parity/lottery-share-ui/README.md`。
- H5微信分享菜单、原生顶部分享菜单/设备发送取消、uni完整视觉仍未完成，抽奖路由继续标为“部分”，全量目标保持进行中。

### H5微信抽奖分享增量（2026-09-06）

- 已接应用入口签名地址记录、微信SDK按需装载、好友/朋友圈新旧菜单配置、预先准备、失败与超时重试。菜单失败仍可复制，未把菜单配置完成展示为邀请已发送。
- 真实浏览器加载原版SDK并用隔离桥接验证参数/状态；普通H5与微信共84帧、3种屏宽，独立双审查通过。348项测试、类型检查、两端构建与预算通过；生产SDK优化前后接口与参数探针一致。证据见 `.omo/evidence/taro-parity/wechat-share-ui/README.md`。
- 小程序顶部分享菜单、原生字符串query解析兼容、真实公众号/设备发送取消和uni完整视觉继续补齐，不将本轮结果视作全量目标完成。

### 小程序推荐参数与分享菜单增量（2026-09-06）

- 修复真实 Taro 原生 URLSearchParams 不支持迭代导致字符串 query 解析失败，保留对象 query/扫码场景行为。
- 顶部好友菜单已接元数据准备、就绪开放、返回刷新及退出登录隐藏；分享回调检查当前账号，避免使用旧账号推广信息。使用实际 Taro 适配器要求的 showShareItems 参数。
- 354 项测试、类型/规则检查、两端构建及预算通过。记录见 `.omo/evidence/taro-parity/native-share/README.md`。
- 本轮没有真机系统菜单视觉或发送/取消证据，上一轮 H5 截图不作为本轮新构建视觉验收。抽奖仍为部分完成，继续核对 uni 完整展示和其余路由。

### 抽奖原版展示与交互复核（2026-09-06）

- 复核16份原版/Taro源码并登记10项原始PNG，整理16项具体差距，详见 `.omo/evidence/taro-parity/lottery-reference-audit/README.md`。
- 新确认遗漏：公开记录开关不应关闭中奖播报；中奖表缺列名与内部滚动；实物奖品应分结果/地址阶段；领奖地址缺三级地区和独立详细地址；评价完成头部、导航标题及通用页首页入口尚未对齐。
- 原始抽奖机、中央按钮、标题和评价页资源均在仓库中，后续应直接复用。当前订单卡片风格不能视为原版展示完成。
- 本轮仅完成源码/资源审计，未改UI或重跑测试，不复用旧截图声称本轮视觉验收。上述差距待实现和同尺寸验证，相关路由继续保持部分完成。

### 中奖播报开关修复（2026-09-06）

- 已按 uni 源码分离公开中奖播报与公开中奖记录表：播报保留服务端记录，表格才受 `is_all_record` 控制；缺少记录字段的合法接口响应按空数组处理。
- 通用抽奖页已切换播报数据源。全量 354 项测试与类型检查通过；本次 UI 同屏和真机视觉仍待完成。

### 抽奖活动皮肤首批迁移（2026-09-06）

- 已将 uni 的 lottery-bag、lottery-click 等原始资产纳入 Taro，并将通用抽奖页切换到红色活动背景、金色棋盘边框、虚线奖品格、活动色中央按钮和活动色操作按钮。
- 播报数据与公开记录开关已分离，测试覆盖未返回记录字段的接口响应。
- 全量 354 项测试与类型检查通过。标题左右装饰、评价专属头部/皮肤、领奖地区选择、原版表格容器和三屏同尺寸视觉验收仍待继续。

### 抽奖活动与评价页皮肤迁移（2026-09-06）

- 通用抽奖页已接入活动红底、金色棋盘边框、虚线奖品格、原版中央抽奖图和活动色按钮。
- 评价抽奖页已加入评价完成状态头部、时间展示、返回首页/返回订单动作，并使用独立活动背景。
- 354 项单测与类型检查通过。原版标题左右装饰、领奖地区选择、地址弹层、原版记录面板和三屏真实视觉对照仍待继续。

### 实物领奖三级地区迁移（2026-09-06）

- PrizeClaim 已从单一完整地址输入扩展为省/市/区 Picker + 详细地址，已存地址选择分别填充地区与门牌；提交时将地区和详细地址按领奖接口字段传递。
- 保留旧的完整地址输入兼容路径，避免已有草稿因地区为空被丢失。失败保留全部输入，服务端确认后才移除表单。
- 354 项测试与类型检查通过；真实地区数据、领奖接口和三屏视觉仍待运行时验收。

### 抽奖记录面板展示迁移（2026-09-06）

- 通用抽奖页公开记录与我的奖品已改为原版风格容器：标题装饰、列标题、独立滚动列表、昵称/序号、奖品名称和获奖时间均明确展示。
- 继续保留后台开关、长文本换行和真实服务端记录；H5 构建/包体预算通过（JS 1733560 bytes，最大 chunk 632237 bytes），354 项测试与类型检查通过。
- 评价页仍待复用同一活动皮肤，真机和三屏同尺寸视觉验收未完成。

### 中奖记录复制反馈迁移（2026-09-07）

- 中奖记录页单号复制改用跨平台 `copyText`，增加“已复制”和失败后长按复制提示；不再无反馈调用原生剪贴板。
- 保留红包待领取/失效、实物补领、快递信息和分页状态。354 项测试与类型检查通过，真实浏览器/真机复制能力仍需验收。

### 中奖记录标题装饰资源接入（2026-09-07）

- 记录面板标题已由字符占位改为复用 uni 原版 `font-left.png` / `font-right.png` 资源，保持原图尺寸约束和可访问文字标题。
- 354 项测试与类型检查通过；仍需在真实 H5 三屏和小程序设备核对资源缩放与深色/失效图片状态。

### 抽奖运行时回归与领奖校验（2026-09-07）

- 真实 H5 访问 `/pages/marketing/lottery?type=1` 已确认活动皮肤入口可达；隔离后端无活动数据时展示“网络请求失败/重新加载活动”，没有伪造活动内容。
- 根据独立代码审查移除未使用抽奖机背景导入；领奖提交增加详细地址必填校验，避免仅提交省市区的无效地址。
- 354 项测试与类型检查通过。当前运行时未获得活动 fixture，活动内容和三屏视觉证据仍需隔离数据注入后验收。

### 营销抽奖资格路由修复（2026-09-07）

- 营销活动接口返回的 `factor`/`lottery_factor` 现在会保留到活动模型；从营销列表进入抽奖时使用服务端资格类型，不再固定写死 type=1，覆盖积分、余额、支付订单、评价订单和活动参与五类入口。
- 未提供合法资格类型时继续使用 type=1 作为兼容默认，最终由活动接口校验，不伪造资格。354 项测试与类型检查通过。

### 启动引导页迁移（2026-09-07）

- 新增 `pages/guide/index`：按 `guideDate` 每日一次请求 `/get_open_adv`，无广告、接口失败或关闭状态直接进入首页；有图片/视频元数据时展示全屏开屏内容与“立即进入”。
- 保留入口 `spid` 并编码传递到首页，已注册到 Taro 主包页面配置。广告状态判定与 uni 一致，状态0不会因返回数组而误展示。
- 类型检查及全量354项单测通过；广告真实数据、首启设备展示和视频播放仍需运行时验收。

### 营销活动入口行为修复（2026-09-07）

- 优惠券活动卡点击进入已有优惠券页；签到卡不再误弹“暂不支持”，由卡内签到动作负责交互；会员活动进入个人中心。红包/赠品因当前 Taro 尚无对应业务页，继续明确提示未开放，不伪造详情。
- 更新交互契约测试，354 项测试与类型检查通过。红包/赠品专属页面仍是全量台账中的待补功能。

### 赠礼领取页首批迁移（2026-09-07）

- 新增 `pages-extra/gift/index`：按订单标识读取 `/order/gift_detail/{id}`，展示赠送人、留言和礼物信息，支持领取中/已领取/失败重试。
- 营销赠品入口已改为进入该领取页；红包入口仍要求从中奖记录进入，避免把不同业务协议混用。接口缺订单标识时明确提示参数缺失。
- 类型检查与全量354项单测通过；真实礼物订单、分享链接和领取结果页的 uni 同屏视觉仍待验收。

### 赠礼领取结果迁移（2026-09-07）

- 领取成功后增加“查看礼物详情”和“返回商城首页”，对应 uni 的领取结果路径；页面保留领取失败重试、已领取禁用和接口状态。
- 增加赠礼页面浅色卡片/橙红主操作视觉，354 项测试与类型检查通过。uni 的真实礼物订单参数、头像/礼物边框资源和全屏结果图仍待同屏验收。

### 浏览足迹页迁移（2026-09-07）

- 新增 `pages-extra/visits/index` 与 `services/visits`：接入 `/user/visit_list` 分页、商品图片/名称/价格/访问时间展示、商品详情跳转、清空记录和失败重试。
- 空态、加载态、分页结束和清空中状态明确；继续使用隔离数据，不触发真实用户记录清理。类型检查通过，单测回归仍在运行。

### 发票抬头基础流程迁移（2026-09-07）

- 新增 `pages-extra/invoice/index` 与 `services/invoices`：接入 `/v2/invoice` 列表、`/v2/invoice/save` 保存、`/v2/invoice/del/{id}` 删除。
- 支持个人/企业抬头、普通/专用发票、企业税号校验、已开票状态、空态和失败重试；个人中心已增加发票管理入口。
- 类型检查与354项单测通过；订单开票回填、发票详情下载和真实开票数据仍待继续迁移。

### 结算发票选择迁移（2026-09-07）
- 结算页加载发票抬头，支持选择已有抬头或不开发票，列表可折叠；选中值写入 `preferences.invoiceId`，沿用既有 `invoice_id` 下单字段。
- 发票接口失败只提示，不阻断其它结算操作；订单发票详情、下载及真实开票回填仍待后端联调。
- 验证：`pnpm test:unit` 53 files / 354 tests passed；`pnpm typecheck` passed；`pnpm build:h5` passed，JS 1,738,651 bytes，最大 chunk 632,237 bytes，维持既有 3 条 webpack 警告。

### 启动引导复核（2026-09-07）
- Taro `pages/guide/index` 已对应 uni `pages/guide/index`：按日缓存 `guideDate`、读取 `/get_open_adv`、支持图片/视频广告、异常或空广告自动进入首页，并保留 `spid` 推荐参数。
- 当前仍需真实广告数据与各端首启/次启同屏验收；不将静态页面视为最终视觉完成。

### 优惠券状态筛选补齐（2026-09-07）
- Taro 优惠券页新增可使用/已使用/已过期/全部筛选，补充到期时间和可用券“去使用”入口，空态随筛选变化。
- 验证：`pnpm test:unit` 53 files / 354 tests passed；类型检查已通过。

### 资产失败态与分类交互（2026-09-07）
- 资产页请求失败显示明确错误态并支持重试，避免将网络异常误显示为空数据；资产明细支持全部/余额/积分/佣金分类。
- 验证：`pnpm typecheck` 与 `pnpm test:unit` 53 files / 354 tests passed。

### 赠礼与代付入口覆盖（2026-09-07）
- 新增 Taro 分包入口 `pages-extra/receive-gift/index` 与 `pages-extra/payment-on-behalf/index`，分别复用赠礼领取页与收银台支付页，覆盖 uni 对应缺失路由的导航落点。
- 当前仍需真实代付订单、礼物领取状态及支付宝回跳渠道联调；H5 构建已验证入口可编译。

### 代付支付状态路由补齐（2026-09-07）
- 新增 `pages-extra/payment-on-behalf/pay-status/index`，覆盖 uni 代付支付结果独立入口，复用 Taro 支付状态展示与失败恢复逻辑。
- 验证：类型检查、H5 构建通过；真实代付订单渠道仍待联调。

### 资产与优惠券筛选视觉补齐（2026-09-07）
- 资产、优惠券分类按钮统一激活态、圆角、间距和横向滚动样式；优惠券可用操作按钮使用品牌色强调。
- H5 构建验证通过，包体预算通过（JS 1,744,132 bytes，最大 chunk 632,237 bytes）。

### 支付宝回跳入口补齐（2026-09-07）
- 新增 `pages-extra/alipay-invoke/index`，接入现有支付状态页，覆盖 uni 支付回跳导航入口；真实支付宝回调参数与渠道验收仍待联调。
- 类型检查通过。

### 当前轮次验证收口（2026-09-07）
- 路由别名、筛选交互和失败态改动均已通过 `git diff --check` 与 TypeScript 类型检查；H5 构建及 354 项单测保持通过。
- 真实支付、客服发送、会员/分销及活动深层流程继续列为待联调和验收项。

### 分销中心入口交互补齐（2026-09-07）
- Taro `pages/distribution` 增加推广用户、推广订单、佣金排行、提现记录、推广二维码、分销等级六项操作入口，分别映射到已注册的 pages-extra 路由；概览页继续展示佣金、人数、二维码和海报。
- 验证：`pnpm typecheck`、`pnpm test:unit`（53 files / 354 tests）。

### 目录级差距复核（2026-09-07）
- 基于真实源码目录复核：uni `pages/**/*.vue` 共 178 个文件，Taro `src/**/*.tsx` 共 98 个页面文件。
- 已覆盖项包含核心首页、商品、购物车、订单、积分、营销、账户、分销、优惠券、资产、评价、发票、赠礼及多组兼容别名。
- 目录差异中仍有后台管理、拼团/砍价/秒杀详情、VIP、线下支付、客服发送、积分商城细分页面等业务缺口；这些不能仅通过别名视为完成，后续需按接口契约逐项实现并做交互验收。
- 活动兼容入口回归：`pnpm test:unit` 53 files / 354 tests 全部通过（2026-09-07）。

### 会员入口回归（2026-09-07）
- VIP 相关 6 个兼容入口文件均已存在并注册至 `pages-extra`。
- `pnpm typecheck` 与 `pnpm test:unit`（53 files / 354 tests）通过。
- 会员真实权益查询、购买、协议详情仍需后端接口契约后独立实现。
- 2026-09-07 目录快照：uni pages 共 178 个 `.vue`，Taro src 共 127 个 `.tsx`；该数字用于后续差距复核基线。
- 页面覆盖脚本 `template/taro-miniapp/scripts/compare-page-coverage.mjs` 已运行验证，输出 JSON 可解析；因目录命名差异，结果仅作候选清单，需结合路由别名映射复核。

### 用户入口语义纠正（2026-09-07）
- 修正此前错误别名：user-info 从客服改为资料编辑；user-phone 从客服改为手机号绑定；user-return-list 从评价改为退款/售后列表。
- 先前“入口全部对应正确业务”的结论撤回。别名存在与类型检查通过不能证明功能对齐；其他活动、会员与分销别名仍需逐项核实。
- 本次类型检查通过，未据此声明浏览器交互或视觉验收完成。
