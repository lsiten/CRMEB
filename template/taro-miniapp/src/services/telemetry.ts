import Taro from '@tarojs/taro';

export type TelemetryName =
  | 'app_start'
  | 'first_screen'
  | 'api_error'
  | 'payment_failed'
  | 'crash'
  | 'funnel';

export type TelemetryEvent = Readonly<{
  name: TelemetryName;
  timestamp: string;
  durationMs?: number;
  path?: string;
  code?: string;
  status?: number;
  funnelStep?: string;
  properties?: Readonly<Record<string, string | number | boolean>>;
}>;

const apiBaseUrl = (process.env.TARO_API_BASE_URL ?? '').replace(/\/$/, '');
const configuredEndpoint = process.env.TARO_TELEMETRY_URL;
const endpoint = (configuredEndpoint || (apiBaseUrl ? `${apiBaseUrl}/monitoring/events` : '')).replace(/\/$/, '');
const tokenKey = 'crmeb_token';
const queue: TelemetryEvent[] = [];
const MAX_QUEUE_SIZE = 200;
let flushScheduled = false;
let flushInFlight = false;

function scheduleFlush(delayMs = 0): void {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushScheduled = false;
    flush();
  }, delayMs);
}

function flush(): void {
  if (queue.length === 0 || !endpoint || flushInFlight) return;
  flushInFlight = true;
  const events = queue.slice();
  const token = Taro.getStorageSync<string>(tokenKey);
  const sameApiOrigin = Boolean(apiBaseUrl && endpoint.startsWith(`${apiBaseUrl}/`));
  const header = token && sameApiOrigin ? { 'Authori-zation': `Bearer ${token}` } : undefined;
  Taro.request({
    url: endpoint,
    method: 'POST',
    data: { events },
    ...(header ? { header } : {}),
    timeout: 3000,
  }).then((response: { statusCode?: number }) => {
    if (typeof response.statusCode === 'number' && (response.statusCode < 200 || response.statusCode >= 300)) {
      throw new Error(`HTTP ${response.statusCode}`);
    }
    queue.splice(0, events.length);
  }).catch((error: unknown) => {
    if (error instanceof Error) console.warn('遥测上报失败', error.message);
    scheduleFlush(1000);
  }).finally(() => {
    flushInFlight = false;
    if (queue.length > 0 && !flushScheduled) scheduleFlush(1000);
  });
}

export function track(name: TelemetryName, fields: Omit<TelemetryEvent, 'name' | 'timestamp'> = {}): void {
  queue.push({ name, timestamp: new Date().toISOString(), ...fields });
  if (queue.length > MAX_QUEUE_SIZE) queue.splice(0, queue.length - MAX_QUEUE_SIZE);
  scheduleFlush();
}

export function startPerformanceTracking(): void {
  const startedAt = Date.now();
  track('app_start', { properties: { platform: Taro.getEnv() } });
  Taro.nextTick(() => track('first_screen', { durationMs: Date.now() - startedAt }));
}
