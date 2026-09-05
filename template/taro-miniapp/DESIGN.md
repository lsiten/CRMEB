## 0. Research Log

- Existing project audit: extracted the current warm red CRMEB palette, 4px spacing rhythm, rounded cards, and compact mobile-first layout from `src/app.scss` and page styles.
- Direction: operational commerce UI with a warm red action color, quiet neutral surfaces, and restrained elevation; prioritize scanability over decoration.

## 1. Tokens

- Colors: `--color-brand` (#e93323), `--color-brand-soft` (#fff0ed), `--color-text` (#222), `--color-text-secondary` (#666), `--color-text-muted` (#999), `--color-surface` (#fff), `--color-page` (#f7f7f7), `--color-border` (#ededed), `--color-overlay` (rgba(0,0,0,.55)).
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
