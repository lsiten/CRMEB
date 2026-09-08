import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
import type { MarketingItem } from '../src/services/marketing';
const platform = vi.hoisted(() => ({ navigateTo: vi.fn(), token: 'session', addServerCart: vi.fn(), requireLogin: vi.fn() }));
vi.mock('@tarojs/components', () => ({ Button: 'button', Text: 'span', View: 'div' }));
const lifecycle = vi.hoisted(() => ({ hide: () => {} }));
vi.mock('@tarojs/taro', () => ({ default: platform, useDidHide: (callback: () => void) => { lifecycle.hide = callback; } }));
vi.mock('../src/services/api', () => ({ getToken: () => platform.token, ApiError: Error }));
vi.mock('../src/services/auth-flow', () => ({ requireLogin: platform.requireLogin }));
vi.mock('../src/services/server-cart', () => ({ addServerCart: platform.addServerCart }));
import { ActivityCheckout } from '../src/pages/marketing/activity-checkout';
const item: MarketingItem = { id: 12, productId: 6, kind: 'seckill', title: '秒杀商品', activityStatus: 1, variants: [{ unique: 'sku-red', label: '红色', price: 10, stock: 3 }] };
const returnUrl = '/pages/marketing/detail?kind=seckill&id=12&time_id=7';
beforeEach(() => { vi.clearAllMocks(); platform.token = 'session'; platform.requireLogin.mockReturnValue(true); platform.addServerCart.mockResolvedValue('cart-20'); });
it('passes the activity SKU to the server and navigates using its cart ID', async () => {
  // Given a purchasable SKU, when buying, then use the server cart contract.
  const page = TestRenderer.create(<ActivityCheckout item={item} returnUrl={returnUrl} />);
  await act(async () => { await page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  expect(platform.addServerCart).toHaveBeenCalledWith(expect.objectContaining({ product: expect.objectContaining({ id: 6, unique: 'sku-red' }), quantity: 1, direct: true, activity: { kind: 'seckill', id: 12 } }));
  expect(platform.navigateTo).toHaveBeenCalledWith({ url: '/pages/order/confirm?cartIds=cart-20&new=1' });
  page.unmount();
});
it('requires login with the original period and makes no cart request for guests', async () => {
  // Given a guest, when buying, then preserve the exact return route.
  platform.requireLogin.mockReturnValue(false);
  const page = TestRenderer.create(<ActivityCheckout item={item} returnUrl={returnUrl} />);
  await act(async () => { await page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  expect(platform.requireLogin).toHaveBeenCalledWith(returnUrl);
  expect(platform.addServerCart).not.toHaveBeenCalled();
  page.unmount();
});
it('locks rapid duplicate submissions until the request settles', async () => {
  // Given a pending cart request, when double tapping, then create only once.
  let resolve: (value: string) => void = () => undefined;
  platform.addServerCart.mockReturnValue(new Promise<string>((done) => { resolve = done; }));
  const page = TestRenderer.create(<ActivityCheckout item={item} returnUrl={returnUrl} />);
  const submit = page.root.findByProps({ children: '立即购买' }).props.onClick;
  let first: Promise<void>;
  await act(async () => { first = submit(); await submit(); });
  expect(platform.addServerCart).toHaveBeenCalledTimes(1);
  await act(async () => { resolve('cart-20'); await first; });
  page.unmount();
});
it('does not navigate into checkout after the account changes', async () => {
  // Given an account change while creating a cart, when it resolves, then prevent cross-account navigation.
  platform.addServerCart.mockImplementation(async () => { platform.token = 'other'; return 'cart-20'; });
  const page = TestRenderer.create(<ActivityCheckout item={item} returnUrl={returnUrl} />);
  await act(async () => { await page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  expect(platform.navigateTo).not.toHaveBeenCalled();
  page.unmount();
});
it.each([0, 2])('prevents purchases when activity status is %s', async (activityStatus) => {
  // Given an inactive period, when invoking the handler, then refuse checkout.
  const page = TestRenderer.create(<ActivityCheckout item={{ ...item, activityStatus }} returnUrl={returnUrl} />);
  await act(async () => { await page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  expect(platform.addServerCart).not.toHaveBeenCalled();
  page.unmount();
});

it('ignores a pending purchase response after leaving the detail page', async () => {
  // Given a pending request, when leaving before its completion, then no late navigation occurs.
  let resolve: (value: string) => void = () => undefined;
  platform.addServerCart.mockReturnValue(new Promise<string>((done) => { resolve = done; }));
  const page = TestRenderer.create(<ActivityCheckout item={item} returnUrl={returnUrl} />);
  let submission: Promise<void>;
  await act(async () => { submission = page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  act(() => page.unmount());
  await act(async () => { resolve('cart-20'); await submission; });
  expect(platform.navigateTo).not.toHaveBeenCalled();
});

it.each(['other-account', ''])('discards a late failure after token changes to %s', async (token) => {
  let reject: (reason: Error) => void = () => undefined;
  platform.addServerCart.mockReturnValue(new Promise<string>((_resolve, fail) => { reject = fail; }));
  const page = TestRenderer.create(<ActivityCheckout item={item} returnUrl={returnUrl} />);
  let submission: Promise<void>;
  await act(async () => { submission = page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  platform.token = token;
  await act(async () => { reject(new Error('旧账号购买失败')); await submission; });
  expect(page.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
  expect(platform.navigateTo).not.toHaveBeenCalled();
  expect(page.root.findByProps({ children: '立即购买' }).props.disabled).toBe(false);
  act(() => page.unmount());
});

it.each(['success', 'failure'])('ignores late %s after hiding without unmounting and allows retry', async (outcome) => {
  let resolve: (value: string) => void = () => undefined;
  let reject: (reason: Error) => void = () => undefined;
  platform.addServerCart.mockReturnValue(new Promise<string>((done, fail) => { resolve = done; reject = fail; }));
  const page = TestRenderer.create(<ActivityCheckout item={item} returnUrl={returnUrl} />);
  let submission: Promise<void>;
  await act(async () => { submission = page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  act(() => lifecycle.hide());
  await act(async () => {
    if (outcome === 'success') resolve('stale-cart');
    else reject(new Error('隐藏页面的旧错误'));
    await submission;
  });
  expect(page.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
  expect(platform.navigateTo).not.toHaveBeenCalled();
  platform.addServerCart.mockResolvedValue('fresh-cart');
  await act(async () => { await page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  expect(platform.navigateTo).toHaveBeenCalledWith({ url: '/pages/order/confirm?cartIds=fresh-cart&new=1' });
  act(() => page.unmount());
});

it('shows a current failure and releases the submit lock for retry', async () => {
  platform.addServerCart.mockRejectedValue(new Error('库存不足'));
  const page = TestRenderer.create(<ActivityCheckout item={item} returnUrl={returnUrl} />);
  await act(async () => { await page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  expect(page.root.findByProps({ role: 'alert' }).props.children).toBe('库存不足');
  platform.addServerCart.mockResolvedValue('retry-cart');
  await act(async () => { await page.root.findByProps({ children: '立即购买' }).props.onClick(); });
  expect(page.root.findAllByProps({ role: 'alert' })).toHaveLength(0);
  expect(platform.navigateTo).toHaveBeenCalledWith({ url: '/pages/order/confirm?cartIds=retry-cart&new=1' });
  act(() => page.unmount());
});
