import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session' }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getVisits } from '../src/services/visits';
beforeEach(() => vi.clearAllMocks());
it('reads visitList data.list and preserves server product fields', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: {
    list: [{ id: 99, product_id: 8, add_time: '2026-09-08 08:00:00', product: { id: 8, store_name: '咖啡', image: '/8.png', price: '12.50' } }], count: 1, time: ['09-08'],
  } } });
  await expect(getVisits(1)).resolves.toEqual([{ id: '99', productId: 8, name: '咖啡', image: '/8.png', price: 12.5, visitedAt: '2026-09-08 08:00:00' }]);
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', data: { page: 1, limit: 20 } }));
});
it('reads the flat product_price field bound by StoreProductLog.storeName', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: {
    list: [{ id: 100, product_id: 9, store_name: '茶', image: '/9.png', product_price: '28.80', add_time: '2026-09-08' }], count: 1,
  } } });
  await expect(getVisits(1)).resolves.toMatchObject([{ name: '茶', price: 28.8 }]);
});
