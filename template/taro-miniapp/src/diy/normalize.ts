export type DiyItem = Readonly<Record<string, unknown>> & { name: string; timestamp?: number; isHide?: boolean };
export type DiyPage = Readonly<{ title: string; version: string; schema_version: number; background: Readonly<Record<string, unknown>>; items: readonly DiyItem[]; raw: unknown }>;
export type DiyRegions = Readonly<{ top: readonly DiyItem[]; content: readonly DiyItem[]; bottom: readonly DiyItem[] }>;

const topRegionNames = ['homeComb', 'headerSerch', 'tabNav'] as const;

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
const timestampOf = (item: DiyItem): number => typeof item.timestamp === 'number' && Number.isFinite(item.timestamp) ? item.timestamp : Number.POSITIVE_INFINITY;

export function normalizeDiyPage(payload: unknown): DiyPage {
  const root = record(payload);
  const data = record(root['data']);
  const source = root['value'] ?? data['value'] ?? root['data'] ?? payload;
  const sourceRecord = record(source);
  const values = Array.isArray(source) ? source : typeof sourceRecord['name'] === 'string' ? [sourceRecord] : Object.values(sourceRecord);
  const items = values.map(record).filter((item): item is DiyItem => typeof item['name'] === 'string' && item['name'].length > 0 && item['isHide'] !== true);
  const hasTimestamp = items.some((item) => timestampOf(item) !== Number.POSITIVE_INFINITY);
  const orderedItems = hasTimestamp ? [...items].sort((a, b) => timestampOf(a) - timestampOf(b)) : items;
  const background = { ...data, ...(record(data['background'])), ...root, ...(record(root['background'])) };
  return {
    title: typeof data['title'] === 'string' ? data['title'] : typeof data['name'] === 'string' ? data['name'] : typeof root['title'] === 'string' ? root['title'] : '',
    version: String(data['version'] ?? root['version'] ?? ''),
    schema_version: typeof data['schema_version'] === 'number' ? data['schema_version'] : typeof root['schema_version'] === 'number' ? root['schema_version'] : 1,
    background,
    items: orderedItems,
    raw: payload,
  };
}

/** Match uni-app's fixed header/content/footer rendering regions. */
export function splitDiyRegions(items: readonly DiyItem[]): DiyRegions {
  const top = topRegionNames.flatMap((name) => items.filter((item) => item.name === name));
  const content = items.filter((item) => item.name !== 'pageFoot' && !topRegionNames.some((name) => name === item.name));
  const bottom = items.filter((item) => item.name === 'pageFoot');
  return { top, content, bottom };
}
