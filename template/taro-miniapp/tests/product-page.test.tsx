import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({
  request: vi.fn(), storage: new Map<string, unknown>(), navigateTo: vi.fn(),
  showToast: vi.fn(), navigateBack: vi.fn(),
}));
vi.mock('@tarojs/taro', () => ({
  default: { ...platform, getStorageSync: (key: string) => platform.storage.get(key), setStorageSync: (key: string, value: unknown) => platform.storage.set(key, value) },
  useRouter: () => ({ params: { id: '800' } }),
}));
vi.mock('@tarojs/components', () => ({ View: 'div', Text: 'span', Button: 'button', RichText: 'article', Image: 'img' }));
vi.mock('../src/components', () => ({ OptimizedImage: 'img' }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import DetailPage from '../src/pages/detail';
let page: TestRenderer.ReactTestRenderer | undefined;
beforeEach(() => { vi.clearAllMocks(); platform.storage.clear(); platform.storage.set('crmeb_token', 'session'); });
afterEach(() => { act(() => page?.unmount()); });
const response = { statusCode: 200, data: { status: 200, data: {
  storeInfo: { id: 800, store_name: '咖啡', image: '/coffee.png', price: '10', stock: 8 },
  productValue: { '热': { unique: 'hot', price: '12', stock: 3 }, '冰': { unique: 'cold', price: '13', stock: 0 } },
} } };
const button = (label: string) => page?.root.findAllByType('button').find((entry) => entry.children.includes(label));

describe('product detail shopping flow', () => {
  it('loads by ID and buys only the selected variant', async () => {
    platform.request.mockResolvedValue(response);
    const existing = [{ id: 800, name: '咖啡', price: 12, image: '/coffee.png', stock: 3, quantity: 2, unique: 'hot', spec: '热' }];
    platform.storage.set('crmeb.cart', existing);
    await act(async () => { page = TestRenderer.create(<DetailPage />); });
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/product/detail/800') }));
    await act(async () => { button('立即购买')?.props.onClick(); });
    expect(platform.navigateTo).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/pages/order/confirm?selection=') }));
    expect(platform.storage.get('crmeb.cart')).toEqual(existing);
    expect(platform.storage.get('crmeb.directCheckout')).toMatchObject({ item: { unique: 'hot', price: 12, stock: 3, spec: '热', quantity: 1 } });
  });
  it('provides retry on request failure', async () => {
    platform.request.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response);
    await act(async () => { page = TestRenderer.create(<DetailPage />); });
    expect(button('重试')).toBeDefined();
    await act(async () => { button('重试')?.props.onClick(); });
    expect(button('立即购买')).toBeDefined();
  });
  it('disables purchasing when the selected SKU is sold out', async () => {
    platform.request.mockResolvedValue(response);
    await act(async () => { page = TestRenderer.create(<DetailPage />); });
    await act(async () => { button('冰')?.props.onClick(); });
    expect(button('立即购买')?.props.disabled).toBe(true);
    expect(button('加入购物车')?.props.disabled).toBe(true);
  });
});
