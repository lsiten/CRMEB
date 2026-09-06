import { beforeEach, describe, expect, it, vi } from 'vitest';
const nav = vi.hoisted(() => ({ navigateTo: vi.fn().mockResolvedValue({}), switchTab: vi.fn().mockResolvedValue({}), showToast: vi.fn().mockResolvedValue({}), setStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: nav }));
import { configuredLink, navigateDiyLink, navigateDiyTab } from '../src/diy/navigation';
beforeEach(() => vi.clearAllMocks());
describe('configured DIY navigation', () => {
  it.each(['javascript:alert(1)', '//evil.example', 'https://evil.example', '/pages/missing/index', '/pages/../user/index'])('rejects unsupported destination %s', async (url) => {
    await navigateDiyLink(url);
    expect(nav.navigateTo).not.toHaveBeenCalled();
    expect(nav.switchTab).not.toHaveBeenCalled();
    expect(nav.showToast).toHaveBeenCalled();
  });
  it('distinguishes an empty link from a menu label', () => {
    expect(configuredLink({ info: [{ title: '标题', value: '商品' }, { title: '链接', value: '' }] })).toBe('');
    expect(configuredLink({ info: [{ title: '链接', value: '/pages/cart/index' }] })).toBe('/pages/cart/index');
    expect(configuredLink({ info: [{ value: '旧轮播' }, { title: '/pages/cart/index' }] })).toBe('/pages/cart/index');
  });
  it('carries a configured category to the catalog', async () => {
    await navigateDiyTab({ dataType: { tabVal: 1 }, classPage: { id: 16 } });
    expect(nav.setStorageSync).toHaveBeenCalledWith('crmeb_diy_category', 16);
    expect(nav.switchTab).toHaveBeenCalledWith({ url: '/pages/goods/index' });
  });
  it('preserves encoded query parameters', async () => {
    await navigateDiyLink('/pages/goods/order_list/index?status=paid&keyword=%E5%95%86%E5%93%81');
    expect(nav.navigateTo).toHaveBeenCalledWith({ url: '/pages/order/list?status=paid&keyword=%E5%95%86%E5%93%81' });
  });
  it('reports navigation rejection', async () => {
    nav.navigateTo.mockRejectedValueOnce({ errMsg: 'fail' });
    await navigateDiyLink('/pages/search/index');
    expect(nav.showToast).toHaveBeenCalledWith({ title: '页面跳转失败，请重试', icon: 'none' });
  });
  it.each([['0', 'unpaid'], ['1', 'paid'], ['2', 'shipping']])('translates legacy order status %s', async (status, mapped) => {
    await navigateDiyLink(`/pages/goods/order_list/index?status=${status}`);
    expect(nav.navigateTo).toHaveBeenCalledWith({ url: `/pages/order/list?status=${mapped}` });
  });
  it('does not silently show all orders for unsupported review status', async () => {
    await navigateDiyLink('/pages/goods/order_list/index?status=3');
    expect(nav.navigateTo).not.toHaveBeenCalled();
    expect(nav.showToast).toHaveBeenCalledWith({ title: '该订单状态暂不支持', icon: 'none' });
  });
});
