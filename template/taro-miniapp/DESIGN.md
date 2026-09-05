## 0. Research Log

- Existing Taro pages and styles were reviewed; this iteration preserves the established CRMEB red/white commerce surface.

## 1. Tokens

- Primary: `#e93323`; text: `#222`; muted: `#888`; border: `#f2f2f2`; surface: `#fff`; page: `#f7f7f7`.
- Spacing uses 8px increments; cards use 16px radius and 16px internal padding.
- Titles are 38px/600, body 28px, metadata 24px.

## 2. Primitives

- `.page` is the padded page shell, `.card` is a white rounded surface, `.primary` is the action/accent color.
- Product media is aspect-fill; primary actions use CRMEB red with white text.

## 3. States and accessibility

- Every data surface has loading, empty and recoverable error states. Disabled purchase controls are visibly muted.
- Interactive controls use native Taro `Button`, `Input`, and click targets with readable labels.

## 4. Motion and responsive behavior

- No decorative motion; state changes use native control feedback. Two-column product grids collapse naturally to the device width.

## 5. Accepted debt

- API fixtures remain compatible with the minimal product payload; optional stock/spec fields are additive until the backend contract is available.
