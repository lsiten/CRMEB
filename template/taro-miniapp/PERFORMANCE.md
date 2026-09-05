## 性能与可观测性

小程序启动时采集 `app_start` 和首屏耗时 `first_screen`；API 失败采集 `api_error`（网络、超时、HTTP、业务错误）；支付下单失败采集 `payment_failed`；React 错误边界采集 `crash`。事件批量 POST 到 `TARO_TELEMETRY_URL`，未配置时使用 `/monitoring/events`，由网关转发到现有日志/指标系统。

建议在监控系统建立以下看板（按 `name` 聚合，按 `properties.platform` 分组）：

- 首屏 P50/P75/P95，目标 P75 ≤ 2s；列表接口 P95 ≤ 800ms。
- API 失败率（`api_error` / API 总请求数）目标 ≤ 1%，按 `code` 拆分。
- 支付失败率（`payment_failed` / 发起支付数）目标 ≤ 2%。
- 崩溃事件数和受影响设备数，任一版本出现异常增长即告警。

包体预算：首发 JS ≤ 2MB、单分包 ≤ 1.5MB；超预算时优先移除重复依赖、将非首屏页面迁入分包，并压缩图片为 WebP/AVIF 后再发布。CDN 图片 URL 由后端返回，客户端不得内嵌原图。
