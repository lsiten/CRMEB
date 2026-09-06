import { sanitizeDiyImageUrl, type DiyItem } from './normalize';

export type DiyRecord = Readonly<Record<string, unknown>>;

export const recordValue = (value: unknown): DiyRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value));
};

export const arrayValue = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];

export const nestedValue = (value: unknown, ...keys: readonly string[]): unknown => {
  let current = value;
  for (const key of keys) {
    if (Array.isArray(current)) {
      const index = Number(key);
      current = Number.isSafeInteger(index) ? current[index] : undefined;
    } else {
      current = recordValue(current)[key];
    }
  }
  return current;
};

export const textValue = (value: unknown, ...keys: readonly string[]): string => {
  const row = recordValue(value);
  for (const key of keys) {
    const candidate = row[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
  }
  return '';
};

export const nestedText = (value: unknown, paths: readonly (readonly string[])[]): string => {
  for (const path of paths) {
    const candidate = nestedValue(value, ...path);
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
  }
  return '';
};

export const numberValue = (value: unknown, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const colorValue = (value: unknown, fallback: string): string => {
  const color = nestedText(value, [
    ['color', '0', 'item'],
    ['default', '0', 'item'],
    ['colorConfig', 'color', '0', 'item'],
  ]);
  return color || fallback;
};

export const imageValue = (value: unknown): string => {
  if (typeof value === 'string') return sanitizeDiyImageUrl(value);
  const row = recordValue(value);
  return sanitizeDiyImageUrl(row['image'] ?? row['img'] ?? row['pic'] ?? row['url']);
};

export const configList = (item: DiyItem | DiyRecord, ...paths: readonly (readonly string[])[]): readonly unknown[] => {
  for (const path of paths) {
    const rows = arrayValue(nestedValue(item, ...path));
    if (rows.length) return rows;
  }
  return [];
};
