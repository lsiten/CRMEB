import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), compute: vi.fn(), create: vi.fn(), redirect: vi.fn(), addresses: vi.fn(), http: vi.fn(), token: 'account-a', hide: () => {}, show: () => {} }));
vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: (key: string) => key === 'crmeb_token' ? mocks.token : 9,
    setStorageSync: (key: string, value: string) => { if (key === 'crmeb_token') mocks.token = value; },
    removeStorageSync: (key: string) => { if (key === 'crmeb_token') mocks.token = ''; },
    request: mocks.http,
    redirectTo: mocks.redirect,
  },
  useDidShow: (callback: () => void) => { mocks.show = callback; useEffect(callback, []); },
  useDidHide: (callback: () => void) => { mocks.hide = callback; },
}));
vi.mock('../src/services/account', () => ({ getAddresses: mocks.addresses }));
vi.mock('../src/services/auth-flow', () => ({ requireLogin: () => true }));
vi.mock('../src/services/checkout', () => ({ confirmCheckout: mocks.confirm, computeCheckout: mocks.compute, createOrder: mocks.create }));
import { useCheckout } from '../src/state/checkout';
import { clearToken, getToken, request, setToken } from '../src/services/api';
let state: ReturnType<typeof useCheckout> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useCheckout({ cartIds: 'cart1', returnUrl: '/pages/order/confirm?cartIds=cart1' }); return null; }
const price = { total: 100, payable: 100, postage: 0, coupon: 0, integral: 0 };
beforeEach(() => {
  vi.resetAllMocks();
  setToken('account-a');
  mocks.addresses.mockResolvedValue([{ id: 9, is_default: 1 }]);
  mocks.confirm.mockResolvedValue({ key: 'stable-key', direct: false, items: [], activity: {} });
  mocks.compute.mockResolvedValue(price);
  mocks.create.mockResolvedValue({ id: 'fresh-order' });
});
afterEach(() => { act(() => page?.unmount()); state = undefined; });
const responses = [
  { name: 'HTTP 401', statusCode: 401, data: {}, token: null, error: '登录已过期' },
  { name: 'business 401', statusCode: 200, data: { status: 401, msg: 'expired' }, token: null, error: 'expired' },
  { name: 'HTTP 500 control', statusCode: 500, data: {}, token: 'account-a', error: '请求失败（500）' },
] as const;
// Review attachment's real request adapter reproduction, extended to order creation.
for (const branch of ['quote', 'create'] as const) {
  for (const response of responses) {
    const target = branch === 'quote' ? mocks.compute : mocks.create;
    const path = `/order/${branch === 'quote' ? 'computed' : 'create'}/stable-key`;
    it(`shows a recoverable ${branch} error for current ${response.name}`, async () => {
      mocks.http.mockResolvedValue(response);
      target.mockImplementationOnce(() => request(path));
      await act(async () => { page = TestRenderer.create(<Probe />); });
      if (branch === 'create') await act(async () => { await state?.submit(); });
      expect(mocks.http).toHaveBeenCalledTimes(1);
      expect(getToken()).toBe(response.token);
      expect(state?.loading).toBe(false);
      expect(state?.submitting).toBe(false);
      expect(state?.error).toBe(response.error);
      expect(mocks.redirect).not.toHaveBeenCalled();
      if (branch === 'quote') expect(state?.price).toBeUndefined();
      await act(async () => { setToken('account-a'); state?.retry(); });
      expect(state?.error).toBe('');
      expect(state?.price).toEqual(price);
      await act(async () => { await state?.submit(); });
      expect(mocks.redirect).toHaveBeenCalledWith({ url: '/pages/order/pay?orderId=fresh-order' });
    });
    for (const change of ['switch', 'logout', 'relogin', 'hide', 'hide-show', 'unmount'] as const) {
      it(`ignores late ${branch} ${response.name} after ${change}`, async () => {
        let finish: (() => void) | undefined;
        mocks.http.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve(response); }));
        target.mockImplementationOnce(() => request(path));
        await act(async () => { page = TestRenderer.create(<Probe />); });
        if (branch === 'create') await act(async () => { void state?.submit(); });
        await act(async () => {
          switch (change) {
            case 'switch': setToken('account-b'); break;
            case 'logout': clearToken(); break;
            case 'relogin': clearToken(); setToken('account-a'); break;
            case 'hide': mocks.hide(); break;
            case 'hide-show': mocks.hide(); mocks.show(); break;
            case 'unmount': page?.unmount(); break;
            default: { const exhaustive: never = change; throw new Error(exhaustive); }
          }
          finish?.();
        });
        expect(mocks.http).toHaveBeenCalledTimes(1);
        expect(mocks.redirect).not.toHaveBeenCalled();
        expect(state?.error).toBe('');
        if (change !== 'unmount') expect(state?.submitting).toBe(false);
        if (change === 'switch') expect(getToken()).toBe('account-b');
        if (change === 'relogin') expect(getToken()).toBe('account-a');
        if (change === 'logout') expect(getToken()).toBeNull();
      });
    }
    if (response.statusCode === 401 || response.data && 'status' in response.data) {
      it(`ignores ${branch} ${response.name} if logout happens after API expiry but before catch`, async () => {
        mocks.http.mockResolvedValue(response);
        target.mockImplementationOnce(() => request(path).catch((cause: unknown) => { clearToken(); throw cause; }));
        await act(async () => { page = TestRenderer.create(<Probe />); });
        if (branch === 'create') await act(async () => { await state?.submit(); });
        expect(state?.error).toBe('');
        expect(mocks.redirect).not.toHaveBeenCalled();
      });
    }
  }
}
for (const response of responses.slice(0, 2)) {
  for (const logout of [false, true]) {
    it(`handles overlapping ${response.name} quotes with intervening logout=${logout}`, async () => {
      const finishes: (() => void)[] = [];
      mocks.http.mockImplementation(() => new Promise((resolve) => { finishes.push(() => resolve(response)); }));
      mocks.compute.mockImplementation(() => request('/order/computed/stable-key'));
      await act(async () => { page = TestRenderer.create(<Probe />); });
      await act(async () => { state?.setPreferences((current) => ({ ...current, mark: 'new quote' })); });
      expect(finishes).toHaveLength(2);
      await act(async () => { finishes[0]?.(); });
      expect(state?.error).toBe('');
      await act(async () => { if (logout) clearToken(); finishes[1]?.(); });
      expect(state?.error).toBe(logout ? '' : response.error);
      expect(state?.price).toBeUndefined();
      expect(mocks.redirect).not.toHaveBeenCalled();
    });
  }
}
