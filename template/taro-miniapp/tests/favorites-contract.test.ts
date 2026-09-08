import { beforeEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session' }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getFavorites, removeFavorite, setFavorite } from '../src/services/favorites';
import { getProduct } from '../src/services/product-detail';
const ok = (data: unknown) => ({ statusCode: 200, data: { status: 200, data } });
beforeEach(() => { vi.clearAllMocks(); platform.request.mockResolvedValue(ok({})); });
describe('server favorites contract', () => {
  it('uses account collection IDs, category and availability with page parameters', async () => {
    platform.request.mockResolvedValue(ok({ list: [
      { product_id: 8, category: 'product', store_name: '咖啡', price: '12.50', image: '/8.png', is_show: 1, is_del: 0 },
      { product_id: 9, category: 'product', store_name: '下架商品', price: '10', is_show: 0, is_del: 0 },
    ], count: 2 }));
    const { items: rows } = await getFavorites(2);
    expect(rows[0]).toMatchObject({ id: 'product:8', productId: 8, price: 12.5, available: true });
    expect(rows[1]?.available).toBe(false);
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/collect/user'), data: { page: 2, limit: 20 } }));
    const first = rows[0];
    if (!first) throw new Error('Missing favorite fixture');
    await removeFavorite(first);
    expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/collect/del'), method: 'POST', data: { id: [8], category: 'product' } }));
  });
  it('adds a scalar ID and deletes an array as required by the PHP controller', async () => {
    await setFavorite(8, true);
    expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/collect/add'), data: { id: 8, category: 'product' } }));
    await setFavorite(8, false);
    expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/collect/del'), data: { id: [8], category: 'product' } }));
  });
  it('rejects invalid IDs and preserves business errors', async () => {
    await expect(setFavorite(0, true)).rejects.toThrow('标识无效');
    expect(platform.request).not.toHaveBeenCalled();
    platform.request.mockResolvedValue({ statusCode: 200, data: { status: 400, msg: '收藏失败' } });
    await expect(setFavorite(8, true)).rejects.toThrow('收藏失败');
  });
  it('reads userCollect from storeInfo rather than local storage', async () => {
    platform.request.mockResolvedValue(ok({ storeInfo: { id: 8, store_name: '咖啡', price: 12, image: '/8.png', userCollect: true }, productValue: {} }));
    await expect(getProduct(8)).resolves.toMatchObject({ collected: true });
  });
});
it('accepts PHP sparse numeric keys and uses count rather than filtered length', async () => {
  platform.request.mockResolvedValue(ok({ list: { 1: { product_id: 8, category: 'product', store_name: '咖啡', price: 12, is_show: 1, is_del: 0 } }, count: 41 }));
  await expect(getFavorites(1)).resolves.toMatchObject({ items: [{ productId: 8 }], hasMore: true });
  platform.request.mockResolvedValue(ok({ list: [], count: 41 }));
  await expect(getFavorites(2)).resolves.toEqual({ items: [], hasMore: true });
  await expect(getFavorites(3)).resolves.toEqual({ items: [], hasMore: false });
});
