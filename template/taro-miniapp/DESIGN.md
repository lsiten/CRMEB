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
