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
import { captureAuthSession, clearToken, getToken, request, setToken } from '../src/services/api';
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
] as const;

const quoteResponse = { statusCode: 200, data: { status: 200, data: { status: 'NONE', result: { total_price: '100', pay_price: '100', pay_postage: '0', coupon_price: '0', deduction_price: '0' } } } };
const existingResponse = { statusCode: 200, data: { status: 200, data: { status: 'ORDER_EXIST' } } };
const changes = ['none', 'switch', 'logout', 'relogin', 'hide', 'hide-show', 'unmount'] as const;
function changeSession(change: typeof changes[number]): void {
  switch (change) {
    case 'none': break;
    case 'switch': setToken('account-b'); break;
    case 'logout': clearToken(); break;
    case 'relogin': setToken('account-a'); break;
    case 'hide': mocks.hide(); break;
    case 'hide-show': mocks.hide(); mocks.show(); break;
    case 'unmount': page?.unmount(); break;
    default: { const exhaustive: never = change; throw new Error(exhaustive); }
  }
}

for (const response of responses) {
  for (const branch of ['quote', 'create', 'detail'] as const) {
    for (const change of changes) {
      it(`preserves ${branch} ${response.name} after B401 and anonymous C401 with ${change}`, async () => {
        const actual = await vi.importActual<typeof import('../src/services/checkout')>('../src/services/checkout');
        let finish: (() => void) | undefined;
        mocks.http.mockImplementationOnce(() => new Promise((resolve) => {
          finish = () => resolve(branch === 'detail' ? existingResponse : response);
        }));
        if (branch === 'create') mocks.create.mockImplementationOnce(actual.createOrder);
        else mocks.compute.mockImplementationOnce(actual.computeCheckout);
        await act(async () => { page = TestRenderer.create(<Probe />); });
        if (branch === 'create') await act(async () => { void state?.submit(); });
        mocks.http.mockResolvedValue(response);
        await expect(request('/concurrent')).rejects.toThrow(response.error);
        const expiredRevision = captureAuthSession().revision;
        expect(getToken()).toBeNull();
        // Detail is itself C: it starts anonymously after A returns ORDER_EXIST.
        if (branch !== 'detail') await expect(request('/v2/invoice')).rejects.toThrow(response.error);
        else {
          let finishDetail: (() => void) | undefined;
          mocks.http.mockImplementationOnce(() => new Promise((resolve) => { finishDetail = () => resolve(response); }));
          await act(async () => { finish?.(); });
          finish = finishDetail;
        }
        await act(async () => { changeSession(change); finish?.(); });
        expect(state?.error).toBe(change === 'none' ? response.error : '');
        expect(mocks.redirect).not.toHaveBeenCalled();
        if (change !== 'unmount') expect(state?.submitting).toBe(false);
        if (change === 'switch') expect(getToken()).toBe('account-b');
        if (change === 'relogin') expect(getToken()).toBe('account-a');
        if (branch === 'detail') expect(mocks.http).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/detail/stable-key') }));
        if (change === 'none') {
          expect(captureAuthSession().revision).toBe(expiredRevision);
          // A fresh login can retry and complete the original checkout.
          mocks.http.mockResolvedValue(quoteResponse);
          mocks.compute.mockImplementation(actual.computeCheckout);
          await act(async () => { setToken('account-a'); state?.retry(); });
          expect(state?.error).toBe('');
          expect(state?.price).toEqual(price);
          await act(async () => { await state?.submit(); });
          expect(mocks.redirect).toHaveBeenCalledWith({ url: '/pages/order/pay?orderId=fresh-order' });
        }
      });
    }
  }
  for (const insertion of ['none', '500', '401'] as const) {
    it(`preserves current quote after stale quote ${response.name}, invoice=${insertion}`, async () => {
      const actual = await vi.importActual<typeof import('../src/services/checkout')>('../src/services/checkout');
      const finishes: (() => void)[] = [];
      mocks.http.mockImplementation(() => new Promise((resolve) => { finishes.push(() => resolve(response)); }));
      mocks.compute.mockImplementation(actual.computeCheckout);
      await act(async () => { page = TestRenderer.create(<Probe />); });
      await act(async () => { state?.setPreferences((current) => ({ ...current, mark: 'new quote' })); });
      expect(finishes).toHaveLength(2);
      await act(async () => { finishes[0]?.(); });
      expect(state?.error).toBe('');
      const expiredRevision = captureAuthSession().revision;
      if (insertion !== 'none') {
        mocks.http.mockResolvedValueOnce(insertion === '500' ? { statusCode: 500, data: {} } : response);
        await expect(request('/v2/invoice')).rejects.toThrow(insertion === '500' ? '请求失败（500）' : response.error);
        expect(mocks.http).toHaveBeenLastCalledWith(expect.objectContaining({ header: expect.not.objectContaining({ 'Authori-zation': expect.anything() }) }));
      }
      await act(async () => { finishes[1]?.(); });
      expect(state?.error).toBe(response.error);
      expect(state?.price).toBeUndefined();
      expect(state?.loading).toBe(false);
      expect(captureAuthSession().revision).toBe(expiredRevision);
      expect(mocks.redirect).not.toHaveBeenCalled();
    });
  }
}
