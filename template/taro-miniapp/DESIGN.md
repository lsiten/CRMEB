## 0. Research Log

- Existing project audit: extracted the current warm red CRMEB palette, 4px spacing rhythm, rounded cards, and compact mobile-first layout from `src/app.scss` and page styles.
- Direction: operational commerce UI with a warm red action color, quiet neutral surfaces, and restrained elevation; prioritize scanability over decoration.

## 1. Tokens

- Colors: `--color-brand` (#c92a1d), `--color-brand-soft` (#fff0ed), `--color-text` (#222), `--color-text-secondary` (#666), `--color-text-muted` (#737373), `--color-surface` (#fff), `--color-page` (#f7f7f7), `--color-border` (#ededed), `--color-overlay` (rgba(0,0,0,.55)).
- Spacing: 4px base; `--space-2` 8px, `--space-3` 12px, `--space-4` 16px, `--space-5` 20px, `--space-6` 24px, `--space-8` 32px.
- Radius: `--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 16px, `--radius-pill` 999px.
- Type: body 28rpx/1.5, secondary 24rpx, title 36rpx/1.35, display 44rpx/1.25.

## 2. Layout and responsiveness

Pages use `min-height: 100dvh`, 24px page gutters, and fluid widths. Controls remain at least 88rpx high for touch; multi-column content collapses to one column below 640px.

## 3. Surface recipe

Cards use a white surface, `--radius-lg`, and a 1px neutral border; elevation is reserved for modal and floating action surfaces.

## 4. Motion

State changes use 160ms opacity/transform transitions. Loading and countdown updates are functional; `prefers-reduced-motion` disables decorative motion.

## 5. Reusable primitives

`NavBar` (default/back action), `Loading`, `Empty`, `Tabs`, `Modal`, `AddressSelector`, `ImagePreview`, `Countdown`, and `Skeleton` expose named, typed props and loading/empty/active/disabled states.

## 6. Accessibility constraints

Interactive controls are native Taro `Button` where possible, provide visible labels, and expose `aria-label` for icon-only actions. Modal closes via an explicit close control and backdrop action.

## 7. Accepted debt

Visual QA is limited to static typecheck/build in this template because no browser harness is configured for the Taro mini-program target.

## 8. Handoff

Import primitives from `src/components`; keep page-specific styles local and use the global token variables for new values.

## 9. 分类、购物车、我的（LSIT-64）

附件是首页及三个底部入口的范围标注，不是三个内页的逐像素稿。延续红白商城风格：分类采用左侧真实分类导航与右侧商品卡片；购物车采用商品卡片、明确选择状态和底部结算栏；个人中心采用浅红身份区、订单入口与服务网格。禁止虚构余额、订单数量或营销权益。

复用 OptimizedImage、Empty 与原生 Button；新增样式限定在页面 class 内，避免 title、empty 等全局选择器互相覆盖。页面内容桌面最大宽度 750PX，手机保持双栏分类结构；操作按钮至少 88px（750 设计稿单位），金额和短标签不换行。购物车底部操作区预留原生 tabBar 与安全区空间。

状态覆盖：分类加载/失败重试/空结果/搜索提交/子分类切换；购物车空态/全选/部分选中/数量边界/确认删除/选中项结算；个人中心游客/已登录/资料加载失败/绑定手机号。登录和支付沿用现有平台能力，H5 不虚构授权成功。验证以 H5 实际渲染和两端构建为准，小程序真机授权仍需微信环境。

H5 使用至少 12PX 的辅助文字、14PX 的正文和 18PX 的标题；操作最小高度 44PX，避免 Taro pxtransform 在手机上缩小点击区域。底部使用仓库原有四组 PNG 导航图标。CommerceImage 为三个内页提供加载失败占位，不替换后端真实商品图。H5 通过 commerce-common 共享跨页服务与组件，保留原包体预算不放宽。

## 10. 账号与地址流程（LSIT-69）

账号页延续原版单列移动表单：白色表面、分组边框、红色主操作和清晰的内联错误；密码与短信登录共享 `.account-field` 表单配方的标签、输入和错误状态。协议确认必须在提交前显式完成，协议正文使用可滚动白色内容面，失败时保留重试入口。

地址管理拆分为列表与编辑页。列表卡片提供选择、默认、编辑、删除状态；编辑页的表单由姓名、电话、三级地区、详细地址和默认开关组成。平台地址导入是可选加速路径，授权取消或拒绝后始终保留手工填写入口。危险操作统一使用现有 `Modal` 二次确认，不以 toast 代替确认。

加载、空、失败三类状态使用现有 `Loading`、`Empty` 与卡片内重试；所有输入与操作在 H5 保持至少 44PX，高风险注销操作与普通主操作保持视觉区分。

## 11. 商品详情对齐（全量迁移）

商品详情使用真实详情接口与 SKU 唯一标识，库存/价格随选择更新。展示状态包括加载、失败重试、缺货、规格选中、图片失效和详情缺省；不提供虚构商品描述或库存。复用 CommerceImage 图片失败占位和现有品牌/表面/文字 token。

详情页及底部操作栏保持最大宽度 750PX；主图为正方形，桌面不拉伸为整屏横图。H5 正文 14PX、辅助文字 12PX、标题 18PX、价格 24PX，按钮/规格最小 44PX；对应小程序 28/24/36/48rpx 和 88rpx 触控尺寸。规格按钮可换行且不截断，内容为底部固定栏预留 96PX 与安全区。富文本图片最大宽度 100%，保留纵横比。

主要用户为手机单手购物者；选中规格须同时提供边框、底色与可访问标签，缺货时仍可查看规格而不能购买。复用现有色彩、间距和圆角，不新增装饰动画。

## 12. 服务端购物车与结算

购物车以账号的服务器记录为准，区分加载、未登录、空、有效/失效商品、更新中与失败重试。数量和删除操作只有服务器确认后才更新；结算选中项使用服务器购物车ID，不把价格作为订单创建依据。

结算保留白色分组卡片、品牌色主按钮、底部实付栏；复用CommerceImage、现有颜色/圆角/间距token。手机正文14PX、辅助文字12PX、页标题20PX，输入与按钮最小44PX；对应小程序28/24/40rpx、88rpx。底部栏最大750PX，页面留96PX和安全区。金额分项包含商品金额、运费、优惠券与积分抵扣。使用积分、地址或配送变化时，实付先显示“计算中”并禁用提交，直至服务器确认。门店必须由用户明确选择并填写自提联系人。

页面服务于需要核对价格与配送的手机购物者；失败时保留选择/备注和同一个创建key，拒绝重复提交。优惠券/门店列表有明确收起动作；空列表不伪造可用选项。当前增量不视为虚拟商品、自定义表单、礼物、发票或预售全场景验收完成。

## 13. 收银台

收银台沿用白色卡片、品牌色金额、明确的支付方式选中标记。页面最大750PX，正文与按钮14PX、订单号12PX、状态18PX、金额32PX；按钮最小44PX。支付方式、金额、余额和截止时间来自服务器。页面包含等待支付、调用中、结果确认中、查询失败、取消支付、支付成功和订单关闭状态；结果确认期间防止重复发起，失败时提供刷新。客户端返回成功不改变服务器支付事实。

H5的Taro按钮可能保留disabled="false"属性，样式必须区分true和false，恢复可用后文字仍有足够对比度。真实渠道配置/授权验证和uni同尺寸视觉对照仍属于后续验收。

## 14. 订单与售后

订单与售后使用同一单列卡片布局，最大宽度750PX；背景、品牌色、文字和分隔线复用全局token。正文14PX、辅助12PX、分组标题16PX、页标题22PX、金额20PX，按钮至少44PX。订单筛选可横向滚动，选中状态使用品牌底色和白字，普通和禁用按钮文字始终可见。新增页面包括售后申请、售后列表与详情，列表明确区分加载、空和请求失败；分页失败保留已加载记录。

售后申请默认不选商品和原因，按可退数量限制选择。数量变化后等待服务器重新核验，再允许提交；退货类型只在服务器许可时出现。申请失败保留说明与数量，成功进入可查看进度的明确结果。退货地址来自商家，提交物流后重新查询售后状态。凭证上传与评价提交见第15节；当前仍需补拆单/礼品/虚拟订单细节以及与uni同屏对照，不能据此宣称完整对齐。

## 15. 凭证与评价

售后凭证最多3张，评价图片最多8张；共享ImageAttachments组件，展示上传成功后的服务端图片、预览、逐张移除和重新添加。选图取消不产生错误，上传失败保留已有图片；上传期间禁用提交和图片删除。缩略图120×100PX，图片操作至少44PX，辅助说明12PX，延续现有颜色token。

订单评价从待评价商品进入，以订单商品unique定位；商品和服务分别由用户选择1至5分，默认未评分。使用感受、图片和评分失败后保留，提交成功后返回订单重新查询已评价状态。评价成功不保证立即公开展示；评价赠送抽奖的资格、实物领奖与记录基础流程见第17节，完整平台领取与视觉仍需继续补齐。

## 16. 商品评价列表

从商品详情进入对应商品评价。首屏显示服务端平均评分、好评率和全部/好评/中评/差评数量，筛选切换重新分页，失败保留重试入口；分页失败保留已加载内容，不把网络错误显示为空评价。每条评价包含匿名昵称、会员标记、评分、时间/规格、正文、可预览图片及商家回复。

延续订单页面的750PX容器和14PX正文/12PX辅助/22PX标题，复用卡片和品牌色选中按钮；筛选自然换行，按钮至少44PX。头像40PX、评价图片88PX，照片按钮提供序号标签；商家回复使用现有浅色背景与16PX内边距，长评论自然换行。没有商品参数的旧评价入口引导至待评价订单，不调用虚构的个人评价接口。完整uni同屏视觉对照仍待进行。

## 17. 评价赠抽奖与领奖

评价成功且后端返回抽奖机会时提供“去抽奖”。活动读取评价资格类型4，显示服务端次数和奖品，三列奖品格中央为抽奖按钮；加载或次数为0时禁用，服务端返回结果后才突出中奖项。网络超时等不确定结果禁止直接重试抽奖，提示先看中奖记录，再由用户明确刷新资格继续。

结果区展示服务端名称/提示，实物奖品可填写收货人、手机和完整地址或使用已存地址；提交失败保留输入，服务端确认后显示领取成功。中奖记录使用分页，支持补领未领取实物、查看快递和复制单号。记录可能包含其他活动奖品，标题使用“我的中奖记录”。复用750PX单列、订单卡片和14/12/22PX字阶、44PX按钮；奖品格图片64PX、选中品牌边框，地址表单全宽。当前格子不模拟随机概率；uni转动动画、其他资格类型和同屏视觉仍待完整对照。

## 18. 微信收款确认

中奖记录中待微信确认的红包提供领取入口，使用转账订单号进入收款页；红包抽奖结果引导至中奖记录。详情读取服务端金额、状态与收款参数。页面复用750PX订单容器、14/12/22PX字阶、卡片和44PX按钮，分为收款方式、金额、状态说明与操作，失败可刷新。

确认期间禁用重复领取。微信界面返回后重新查询服务端，只有SUCCESS展示收款成功；未到账、取消、参数缺失、环境不支持、跨渠道和查询失败均有可恢复提示。页面返回前台重新核对状态。微信小程序与公众号H5分别调用对应平台接口；真实渠道/真机与uni同尺寸视觉仍需验收。

## 19. 通用抽奖

通用抽奖复用第17节的750PX单列、订单卡片、14/12/22PX字阶和44PX按钮。头图使用服务端图片，宽度100%、高度180PX，aspectFit保留内容；活动规则和公开/个人中奖记录遵守后台开关。中奖列表按昵称/奖品/时间展示，手机允许换行。轮播仅使用真实公开中奖记录，支持关闭动态效果。

九宫格按顺时针排列8个奖品，中央按钮明确单次积分/余额消耗和剩余机会。收到服务器结果后，选中指示逐格行进三圈并减速停在中奖项；没有结果时不虚构停点。步进80–200ms，路由卸载清理计时器；减少动画时直接定位结果。抽奖及转动期间禁用重复操作，关闭结果后刷新次数。

结果与关注二维码复用Modal，宽度最大600PX、最大高度85vh，正文区域可滚动，长地址表单不能越过屏幕。弹层采用160ms opacity进入，减少动画时关闭；参考beui.dev center-morph-modal的受控可见性、独立遮罩和减少动画机制，不引入Motion依赖。关注返回有独立二维码与关闭后刷新入口。当前仍需uni同尺寸画面对照、微信分享与真机验收，不以结构迁移宣称像素一致。

评价专属抽奖复用通用页的LotteryGrid棋盘、useLotteryMotion动画和Modal结果层：8格顺时针、服务端停点、减少动画及停止后开结果一致。评价页保留返回订单并补返回首页，加载/核对/失败与次数为零状态明确；结果弹层沿用第19节尺寸和滚动约束。新共享组件只决定真实奖品布局与交互状态，不改变资格、奖品概率或服务器次数。

通用抽奖增加邀请好友入口，沿用order-actions按钮与Modal。分享弹层区分生成中、可分享、生成失败与复制失败；链接使用12PX辅助文字、允许任意位置换行和长按选择。H5复制成功只提示链接已复制，小程序通过原生分享按钮发送，均不宣称好友已收到。关闭和失败保留明确操作，游客先登录并返回同一活动。复用160ms弹层进入与减少动画规则，不新增装饰动效。

微信内的抽奖邀请复用同一弹层，新增菜单准备中、右上角分享提示及失败后的复制/重试选项。菜单就绪不表示发送完成；SDK异常不阻断已有邀请链接的复制。继续使用现有文字、警告框与按钮，不新增视觉令牌或动画。

## 20. 抽奖原版活动皮肤（迁移中）

以 `.omo/evidence/taro-parity/lottery-reference-audit/README.md` 的源码和资源为合同，覆盖第19节原有订单白卡的默认外观。通用页使用 #e74435 红底，服务端头图按750:580比例、抽奖机按750:800比例，机器与头图重叠200/750容器宽度；棋盘宽560/750。评价页独立完成状态头部及pay-lottery背景，棋盘宽700/750。大屏暂遵守既有最大750PX容器，原版大屏运行时比例仍待同屏验证。

活动专属token：页面/文字红 #e74435，浅金 #ffd68e，激活金 #ffd18d，激活字 #0e62ff，虚线 #ff7f5f，表面 #fffefe，表面底影 #fcf5c8，表头 #a57e7e；普通格渐变白到#fff2f2。资产直接复用uni原图，装饰图不接点击、不替代真实文本。共享棋盘支持普通和活动皮肤，中央保持原生Button及44PX触控下限，忙碌、0次、配置错误明确展示。

共享装饰面板用于规则与中奖表，含左右标题饰图、虚线内边、固定列标题和100PX内部记录滚动区；公开表开关与播报数据独立。通用页邀请按钮仅factor5展示，原生分享钩子继续为各活动配置。错误恢复、减少动画、账户检查和分享失败复制路径全部保留。此节是实施合同，不代表同尺寸视觉验收完成；两页所有状态需重新截图。
