# 售后读取契约（LSIT-14）

本批以 `4e1a270d9` 的服务端与 UniApp 源码为对照，只补齐 Taro 售后列表/详情读取。详情暂为只读进度页，移除原撤销、删除、退货物流提交控件；独立申请页和底层写接口保持原状，不属于本批验收。

- GET `/order/refund/list`：page 从1开始，limit=20，响应 `status/msg/data:{list,count,num}（本批不使用num统计）`。控制器限定当前 uid、is_cancel=0、is_del=0。本批保持“全部”列表，不添加筛选；空 list 才是无记录，错误及畸形数据不能显示成功空态。
- GET `/order/refund/detail/:uni`：uni 为售后 `order_id`，不是数据库 id 或原订单号；响应 data 为记录。校验响应售后号与路由相同；缺参不发请求，失败有重试/返回列表。服务端不存在返回业务失败，不当作正常空记录。
- 认证沿用 `Authori-zation: Bearer`、`Form-type`，请求层处理 HTTP/业务401。游客不发上述请求；换号、主动退出、同 token 重登立即隐藏旧数据与错误；隐藏/卸载阻断旧回调，返回前台重新读；分页错误保留本会话前页并重试失败页。
- `refund_type`：1 退款审核、2 退货审核、3 拒绝退款、4 待寄回、5 等待商家收货退款、6 已退款。`is_cancel=1` 优先展示已撤销；未知状态报可恢复错误。服务端 `_status._msg` 将1/2/4/5统称审核中，因此4/5使用明确阶段说明，3显示 refuse_reason。
- 申请退款金额取 refund_price（兼容 pay_price，服务端将其赋为 refund_price），始终标“申请退款金额”。只有type=6且未撤销额外展示“已退金额”，独立取 refunded_price，不回退到申请额或支付额；例如申请100、实退60分别显示¥100.00和¥60.00。实退字段缺失、null、空串或纯空白显示“暂未提供”，数值0或字符串0.00显示¥0.00；其他非法值保留金额错误/重试。两种金额均为元，不做价格重算。商品展示服务端返回的 cart_num 数量（详情split分支会将其改为surplus_num，完整拆单售后仍未验收），不使用 surplus_num/refund_num 差值；申请页仍使用剩余可退数量。
- 列表原订单号为 store_order_order_id，详情为 store_order_sn。商品为 cartInfo/cart_info 数组；详情空商品、缺原因/订单号、缺退货地址各有明确缺省说明。退货地址来源 `_status.refund_name/refund_phone/refund_address`，物流展示 refund_express_name/refund_express；本批不扩展物流轨迹读取。

源码定位：`crmeb/app/api/route/v1.php:337`、`StoreOrderRefundController.php:42`（均在 app/api/controller/v1/order 下）、`crmeb/app/services/order/StoreOrderRefundServices.php:1123,1193`、`template/uni-app/api/order.js:361,369`、`template/uni-app/pages/users/user_return_list/index.vue`、`template/uni-app/pages/goods/order_details/index.vue`。

接口风险交接知衡：上述详情控制器没有传入当前 uid，服务 refundDetail 只按 order_id 查询，未见 uid/is_cancel/is_del 限制。认证中间件只证明已登录，客户端会话隔离不能修复服务端对象权限。服务端与UniApp依任务不改；上线前须由知衡安排服务端归属校验和跨账号真实联调，不宣称此风险已修复。本批不触发任何真实售后/支付操作。
