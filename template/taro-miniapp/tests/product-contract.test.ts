import { beforeEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => null }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getProduct, parseProducts } from '../src/services/api';
beforeEach(() => vi.clearAllMocks());

describe('CRMEB product detail', () => {
  it('loads storeInfo for an arbitrary product ID without relying on the first list page', async () => {
    platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: {
      storeInfo: { id: 800, store_name: '咖啡', image: '/coffee.png', price: '10', stock: 8, description: '<p>真实详情</p>' },
      productValue: { '大杯,热': { unique: 'sku-hot', price: '12', stock: 3, image: '/hot.png' }, '大杯,冰': { unique: 'sku-cold', price: '13', stock: 0 } },
    } } });
    await expect(getProduct(800)).resolves.toMatchObject({ id: 800, stock: 8, description: '<p>真实详情</p>', specs: ['大杯,热', '大杯,冰'], variants: [
      { unique: 'sku-hot', label: '大杯,热', price: 12, stock: 3 }, { unique: 'sku-cold', label: '大杯,冰', price: 13, stock: 0 },
    ] });
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/product/detail/800') }));
  });
  it('preserves zero stock in list payloads', () => {
    expect(parseProducts({ data: [{ id: 7, store_name: '售罄商品', image: '/7.png', price: '10', stock: '0' }] })[0]).toMatchObject({ stock: 0 });
  });
});
