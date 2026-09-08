# LSIT-14 客户端增量交接

日期：2026-09-08。范围仅 `template/taro-miniapp/`，星舟为本轮修改负责人；服务端、uni-app、后台及根目录未修改。此记录是本轮实测，不能替代全量 Taro/uni-app 功能或像素验收。

## 现状与缺口

- 当前源码已有服务端购物车、下单/收银台、订单/售后、评价、抽奖、账号和地址等实现；README 中“购物车仅本地保存”的旧描述已不符合源码。
- 本轮完成：收藏从设备共享 Storage 改为当前账号服务端列表和增删；商品详情使用 `storeInfo.userCollect`。旧 `crmeb.favorites` 不再读取，不自动上传（旧数据不具备账号归属）。
- 收藏增加游客入口、分页、错误重试、失效提示、图片失败占位、取消确认、失败保留以及提交锁。服务端过滤关联商品后可能返回数字键对象和不足20条的非末页，已兼容并按 `count` 判断后续页。
- 足迹修正 `data.list` 与 `product_price`；缺少价格不再伪装为零元。增加游客入口、空态、失败重试与原生按钮入口。
- 撤下原先无效的“清空记录”：原调用未传 `ids`，服务端实际不会删除。暂不改为传 IDs，因为 `UserController::visitDelete` 目前没有限定 `type=visit`，可能连同其他商品日志删除。需知衡协调磐石确认并修正服务端范围后再启用删除；本轮未请求该删除接口。
- 仍有明确待推进项：优惠券页面加载失败被当作空列表、营销/会员及其他简略页需逐项对照、订单特殊场景与 uni-app 同尺寸视觉对照。此次只是广泛补齐任务的一批增量，LSIT-14 不应据此关闭。

## 接口交接（复用既有契约，无服务端接口变更）

| 行为 | 请求/响应 |
| --- | --- |
| 收藏列表 | `GET /api/collect/user?page=N&limit=20`；`data.list` 数组或数字键对象，`data.count` 为原始记录总数；字段 `product_id/category/store_name/image/price/is_show/is_del` |
| 添加收藏 | `POST /api/collect/add`，JSON `{id: 商品ID, category: "product"}` |
| 取消详情收藏 | `POST /api/collect/del`，JSON `{id: [商品ID], category: "product"}`；列表取消保留该条服务端 category |
| 收藏状态 | `GET /api/product/detail/:id` 的 `data.storeInfo.userCollect` |
| 足迹列表 | `GET /api/user/visit_list?page=N&limit=20`；`data.list`；价格来自关联模型平铺字段 `product_price` |

认证继续使用请求层 `Authori-zation: Bearer …`、`Form-type`，业务信封沿用 `status/msg/data`，401 继续由现有请求层清理登录态。金额只作展示，不作为结算依据。两个构建目标使用相同适配代码；UniApp行为未改。

服务端依据：`crmeb/app/api/controller/v1/user/UserCollectController.php`、`StoreProductRelationServices::getUserCollectProduct`、`UserController::visitList/visitDelete`、`StoreProductLog::storeName`。这些文件仅只读核对，没有真实数据库或 HTTP 联调。

## 本轮验证

在 `template/taro-miniapp` 下运行：

- `pnpm install --frozen-lockfile`：成功，lockfile未改，复用已有依赖缓存。
- 基线 `pnpm typecheck`、`pnpm test:unit`：55个测试文件、359项通过。
- 新增足迹契约测试在旧代码上失败：`ApiError: 商品数据不完整，请重试`；修正后通过。
- 最终 `pnpm typecheck`、`pnpm test:unit`：57个测试文件、369项通过。覆盖详情游客收藏、重复提交、失败不翻转、收藏增删形状、服务端状态、稀疏列表与空过滤页分页、足迹列表/价格。
- `pnpm build:h5`：通过；JS合计1950765 bytes，最大chunk632237 bytes，预算通过。存在既有Sass弃用和Webpack资源/入口大小告警。
- `pnpm build:weapp`：通过；JS合计758450 bytes，最大chunk95496 bytes，预算通过。存在Sass/CSS合并顺序告警，未调整预算或掩盖告警。
- 两端共用dist，已分别复制并压缩留存。H5构建包在注入任何QA模拟脚本之前生成。
- ego-browser：375/768/1280视口下检查收藏、足迹、详情；375视口检查确认弹窗、取消失败保留/成功刷新、列表失败重试、游客入口、过滤空页、足迹空态、加载更多到第22项及详情取消后文案变化。检查横向溢出为false，收藏操作高度44 CSS px。

浏览器测试使用本轮创建的模拟API与虚构商品数据，证明UI及客户端请求流程，不证明真实后端或数据库结果。QA服务器只用于本轮，将在交付前停止。早期脚本只替换XHR而未替换fetch，未作为成功证据；最终QA构建明确拦截fetch并统一访问本地模拟API。

## 未验证与风险

- 未做真实账号/数据库联调，未验证跨设备收藏同步；实现与仓库服务端源码契约一致不等于线上通过。
- 未做微信开发者工具/真机、微信登录/手机号/支付联调；小程序产物不是这些能力的验收结论。
- 未测 Lighthouse、react-scan 性能评分；未做 uni-app 原版同屏像素对照。
- 浏览记录删除依赖服务端限定日志类型。其余简略页、优惠券错误态和全量功能清单仍需知衡继续划分与验收。
- 各文件职责为页面展示、协议适配或共享分页；未新增运行依赖、全局样式或金额计算路径。新增协议边界使用项目现有unknown解析工具，未引入any断言或吞掉协议错误。
