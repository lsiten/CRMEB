export type DiyItem = Readonly<Record<string, unknown>> & { name: string; timestamp?: number; isHide?: boolean };
export type DiyPage = Readonly<{ title: string; version: string; schema_version: number; background: Readonly<Record<string, unknown>>; items: readonly DiyItem[]; raw: unknown }>;

const configuredImageHosts = (process.env.TARO_IMAGE_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter((host) => host.length > 0);

/** Return only HTTPS images hosted on an explicitly allowed domain. */
export function sanitizeDiyImageUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return '';
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return '';
    const hostname = url.hostname.toLowerCase();
    return configuredImageHosts.includes(hostname) ? url.toString() : '';
  } catch {
    return '';
  }
}

const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
export function normalizeDiyPage(payload: unknown): DiyPage {
  const root = record(payload);
  const data = record(root['data']);
  // v2 returns `{ code, data: { title, value: {...} } }`; older deployments
  // return `{ title, value: {...} }` directly. Unwrap either envelope first.
  const page = Object.keys(data).length > 0 ? data : root;
  const source = page['value'] ?? page['data'] ?? payload;
  const sourceRecord = record(source);
  const values = Array.isArray(source) ? source : typeof sourceRecord['name'] === 'string' ? [sourceRecord] : Object.values(sourceRecord);
  const items = values.map(record).filter((item): item is DiyItem => typeof item['name'] === 'string' && item['name'].length > 0 && item['isHide'] !== true);
  const hasTimestamp = items.some((item) => typeof item.timestamp === 'number');
  const orderedItems = hasTimestamp ? [...items].sort((a, b) => (a.timestamp ?? Number.MAX_SAFE_INTEGER) - (b.timestamp ?? Number.MAX_SAFE_INTEGER)) : items;
  const background = { ...root, ...page, ...(record(page['background'])) };
  return {
    title: typeof page['title'] === 'string' ? page['title'] : typeof page['name'] === 'string' ? page['name'] : '',
    version: String(page['version'] ?? root['version'] ?? ''),
    schema_version: typeof page['schema_version'] === 'number' ? page['schema_version'] : typeof root['schema_version'] === 'number' ? root['schema_version'] : 1,
    background,
    items: orderedItems,
    raw: payload,
  };
}
