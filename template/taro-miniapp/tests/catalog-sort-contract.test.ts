import { beforeEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => '' }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getCategoryProducts } from '../src/services/catalog';
import type { CatalogSort } from '../src/services/catalog';

beforeEach(() => {
  vi.clearAllMocks();
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: [] } });
});
describe('catalog server sorting contract', () => {
  const cases: ReadonlyArray<readonly [CatalogSort, string]> = [
    ['default', ''], ['sales', '&salesOrder=desc'], ['price-asc', '&priceOrder=asc'], ['price-desc', '&priceOrder=desc'],
  ];
  it.each(cases)('uses the existing API parameters for %s', async (sort, suffix) => {
    await getCategoryProducts({ categoryId: 3, keyword: '杯 & 茶', page: 2, sort });
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({
      method: 'GET', url: expect.stringContaining(`/products?selectId=3&keyword=%E6%9D%AF%20%26%20%E8%8C%B6&page=2&limit=20${suffix}`),
    }));
    const url = new URL(platform.request.mock.calls[0]?.[0].url);
    expect(url.searchParams.has('salesOrder') && url.searchParams.has('priceOrder')).toBe(false);
    if (sort === 'default') expect(url.searchParams.has('priceOrder') || url.searchParams.has('salesOrder')).toBe(false);
  });
});
