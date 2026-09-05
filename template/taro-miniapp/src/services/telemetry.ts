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

const endpoint = (process.env['TARO_TELEMETRY_URL'] ?? '/monitoring/events').replace(/\/$/, '');
const queue: TelemetryEvent[] = [];
let flushScheduled = false;

function flush(): void {
  if (queue.length === 0 || !endpoint) return;
  const events = queue.splice(0, queue.length);
  Taro.request({
    url: endpoint,
    method: 'POST',
    data: { events },
    timeout: 3000,
  }).catch((error: unknown) => {
    if (error instanceof Error) console.warn('遥测上报失败', error.message);
  });
}

export function track(name: TelemetryName, fields: Omit<TelemetryEvent, 'name' | 'timestamp'> = {}): void {
  queue.push({ name, timestamp: new Date().toISOString(), ...fields });
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      flush();
    }, 0);
  }
}

export function startPerformanceTracking(): void {
  const startedAt = Date.now();
  track('app_start', { properties: { platform: Taro.getEnv() } });
  setTimeout(() => track('first_screen', { durationMs: Date.now() - startedAt }), 0);
}
