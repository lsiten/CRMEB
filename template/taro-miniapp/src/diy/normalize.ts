export type DiyItem = Readonly<Record<string, unknown>> & { name: string; timestamp?: number; isHide?: boolean };
export type DiyPage = Readonly<{ title: string; version: string; schema_version: number; background: Readonly<Record<string, unknown>>; items: readonly DiyItem[]; raw: unknown }>;

const record = (value: unknown): Record<string, unknown> => typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
export function normalizeDiyPage(payload: unknown): DiyPage {
  const root = record(payload);
  const source = root['value'] ?? payload;
  const values = Array.isArray(source) ? source : Object.values(record(source));
  const items = values.map(record).filter((item): item is DiyItem => typeof item['name'] === 'string' && (item['name'] as string).length > 0 && item['isHide'] !== true)
    .map((item) => item as DiyItem);
  const hasTimestamp = items.some((item) => typeof item.timestamp === 'number');
  if (hasTimestamp) items.sort((a, b) => (a.timestamp ?? Number.MAX_SAFE_INTEGER) - (b.timestamp ?? Number.MAX_SAFE_INTEGER));
  const background = { ...root, ...(record(root['background'])) };
  return { title: typeof root['title'] === 'string' ? root['title'] : '', version: String(root['version'] ?? ''), schema_version: typeof root['schema_version'] === 'number' ? root['schema_version'] : 1, background, items, raw: payload };
}
