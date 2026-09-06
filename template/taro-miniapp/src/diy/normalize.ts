export type DiyItem = Readonly<Record<string, unknown>> & { name: string; timestamp?: number; isHide?: boolean };
export type DiyPage = Readonly<{ title: string; version: string; schema_version: number; background: Readonly<Record<string, unknown>>; items: readonly DiyItem[]; raw: unknown }>;
export type DiyRegions = Readonly<{ top: readonly DiyItem[]; content: readonly DiyItem[]; bottom: readonly DiyItem[] }>;

const topRegionNames = ['homeComb', 'headerSerch', 'tabNav'] as const;

const configuredImageHosts = (process.env.TARO_IMAGE_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim().toLowerCase())
  .filter((host) => host.length > 0);

const apiBaseUrl = process.env.TARO_API_BASE_URL ?? 'http://127.0.0.1:8080/api';
const configuredAssetBase = process.env.TARO_IMAGE_CDN || process.env.TARO_IMAGE_HOST || apiBaseUrl;
const assetOrigin = (() => {
  try {
    return new URL(configuredAssetBase).origin;
  } catch {
    return '';
  }
})();

/** Keep theme assets on the current deployment while allowing explicit remote hosts. */
export function sanitizeDiyImageUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) return '';
  const source = value.trim();
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(source)) return source;
  try {
    const url = new URL(source, assetOrigin || undefined);
    if (assetOrigin && url.pathname.startsWith('/uploads/')) return new URL(`${url.pathname}${url.search}${url.hash}`, assetOrigin).toString();
    if (url.protocol !== 'https:' && url.origin !== assetOrigin) return '';
    const hostname = url.hostname.toLowerCase();
    return url.origin === assetOrigin || configuredImageHosts.includes(hostname) ? url.toString() : '';
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
