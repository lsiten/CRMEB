import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigation = vi.hoisted(() => ({ navigateTo: vi.fn().mockResolvedValue({}), switchTab: vi.fn().mockResolvedValue({}), showToast: vi.fn().mockResolvedValue({}), getCurrentInstance: () => ({ router: { params: { kind: 'bargain' } } }) }));
vi.mock('@tarojs/taro', () => ({ default: navigation }));
vi.mock('@tarojs/components', () => ({ Image: 'image', Text: 'span', View: 'div', Button: 'button' }));
vi.mock('../src/components', () => ({ Empty: () => null, Loading: () => null }));
vi.mock('../src/services/marketing', () => ({ getMarketingItems: vi.fn().mockResolvedValue([]) }));
import { ActivityBlock, GenericSection, ProductList, PromotionTabs, SignIn } from '../src/diy/commerce-renderers';
import MarketingPage from '../src/pages/marketing/index';
import { getMarketingItems } from '../src/services/marketing';

beforeEach(() => vi.clearAllMocks());
describe('DIY commerce interactions', () => {
  it('reloads the same category after a failed load when retry is clicked', async () => {
    vi.mocked(getMarketingItems).mockRejectedValueOnce(new Error('offline'));
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => { renderer = TestRenderer.create(<MarketingPage />); });
    if (!renderer) throw new Error('Renderer was not created');
    await act(async () => { renderer?.root.findByProps({ size: 'mini' }).props.onClick(); });
    expect(getMarketingItems).toHaveBeenCalledTimes(2);
    expect(renderer.root.findAllByProps({ size: 'mini' })).toHaveLength(0);
  });
  it('loads the requested activity category when opened from DIY', async () => {
    await act(async () => { TestRenderer.create(<MarketingPage />); });
    expect(getMarketingItems).toHaveBeenCalledWith('bargain');
  });
  it.each(['sign', 'coupon', 'lottery'] as const)('does not open a product detail for a %s reward', async (kind) => {
    vi.mocked(getMarketingItems).mockResolvedValueOnce([{ id: 1, kind, title: 'Reward' }]);
    let renderer: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => { renderer = TestRenderer.create(<MarketingPage />); });
    if (!renderer) throw new Error('Renderer was not created');
    await renderer.root.findByProps({ className: 'card activity' }).props.onClick();
    expect(navigation.navigateTo).not.toHaveBeenCalled();
    expect(navigation.showToast).toHaveBeenCalledWith({ title: '该活动暂不支持在线参与', icon: 'none' });
  });
  it('opens the product detail when a product is clicked', async () => {
    const root = TestRenderer.create(<ProductList item={{ name: 'goodList', goodsList: { list: [{ id: 42 }] } }} />).root;
    await root.findByProps({ className: 'diy-product' }).props.onClick();
    expect(navigation.navigateTo).toHaveBeenCalledWith({ url: '/pages/detail/index?id=42' });
  });
  it('reports missing product identity when a placeholder is clicked', async () => {
    const root = TestRenderer.create(<ProductList item={{ name: 'goodList', goodsList: { list: [{}] } }} />).root;
    await root.findByProps({ className: 'diy-product' }).props.onClick();
    expect(navigation.navigateTo).not.toHaveBeenCalled();
    expect(navigation.showToast).toHaveBeenCalled();
  });
  it.each(['seckill', 'combination', 'bargain'])('opens %s activity detail when its product is clicked', async (kind) => {
    const root = TestRenderer.create(<ActivityBlock item={{ name: kind, goodsList: { list: [{ id: 17, product_id: 42 }] } }} />).root;
    await root.findByProps({ className: 'diy-product' }).props.onClick();
    expect(navigation.navigateTo).toHaveBeenCalledWith({ url: `/pages/marketing/detail?kind=${kind}&id=17` });
  });
  it('opens the matching campaign list when more is clicked', async () => {
    const root = TestRenderer.create(<ActivityBlock item={{ name: 'bargain', goodsList: { list: [{ id: 17 }] } }} />).root;
    await root.findByProps({ className: 'diy-section-heading__more' }).props.onClick();
    expect(navigation.navigateTo).toHaveBeenCalledWith({ url: '/pages/marketing/index?kind=bargain' });
  });
  it('changes the visible products when a promotion tab is clicked', () => {
    const root = TestRenderer.create(<PromotionTabs item={{ name: 'promotionList', tabConfig: { list: [
      { goodsList: { list: [{ id: 1, store_name: 'First' }] } },
      { goodsList: { list: [{ id: 2, store_name: 'Second' }] } },
    ] } }} />).root;
    act(() => root.findByProps({ className: 'diy-promotion__tab' }).props.onClick());
    expect(root.findByProps({ className: 'diy-product__name' }).children).toEqual(['Second']);
  });
  it('submits sign-in when the action is clicked', async () => {
    const root = TestRenderer.create(<SignIn item={{ name: 'signIn' }} />).root;
    expect(root.findByProps({ className: 'diy-sign-in__button' }).props.reward).toEqual({ kind: 'sign' });
  });
  it.each([['coupon', '/pages/marketing/index?kind=coupon'], ['pointsMall', '/pages/integral/index'], ['customerService', '/pages-extra/customer/index'], ['articleList', '/pages/news/index']])('opens the implemented %s page', async (name, url) => {
    const root = TestRenderer.create(<GenericSection item={{ name }} />).root;
    await root.findByProps({ className: 'diy-generic-section' }).props.onClick();
    expect(navigation.navigateTo).toHaveBeenCalledWith({ url });
  });
  it('reports unavailable content when an unsupported section is clicked', async () => {
    const root = TestRenderer.create(<GenericSection item={{ name: 'liveBroadcast' }} />).root;
    await root.findByProps({ className: 'diy-generic-section' }).props.onClick();
    expect(navigation.showToast).toHaveBeenCalledWith({ title: '该功能暂未开放', icon: 'none' });
    expect(navigation.navigateTo).not.toHaveBeenCalled();
  });
});
