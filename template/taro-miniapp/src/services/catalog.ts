import { parseProducts, request } from './api';
import type { Product } from './api';

export type Category = Readonly<{ id: number; name: string; children: readonly Category[] }>;

export function parseCategories(value: unknown): readonly Category[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown): Category[] => {
    if (typeof item !== 'object' || item === null || !('id' in item) || !('cate_name' in item)) return [];
    const id = Number(item.id);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof item.cate_name !== 'string' || !item.cate_name.trim()) return [];
    return [{ id, name: item.cate_name, children: parseCategories('children' in item ? item.children : []) }];
  });
}

export async function getCategories(): Promise<readonly Category[]> {
  const payload = await request<Readonly<{ data?: unknown }>>('/category', { method: 'GET' });
  return parseCategories(payload.data);
}

export async function getCategoryProducts(query: Readonly<{ categoryId: number; keyword: string; page: number }>): Promise<readonly Product[]> {
  const payload = await request<Readonly<{ data?: unknown }>>(`/products?selectId=${query.categoryId}&keyword=${encodeURIComponent(query.keyword)}&page=${query.page}&limit=20`, { method: 'GET' });
  return parseProducts(payload, 20);
}
