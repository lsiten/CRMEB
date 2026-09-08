import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), compute: vi.fn(), create: vi.fn(), redirect: vi.fn(), addresses: vi.fn(), token: 'account-a', hide: () => {}, show: () => {} }));
vi.mock('@tarojs/taro', () => ({
  default: { getStorageSync: (key: string) => key === 'crmeb_token' ? mocks.token : 9, redirectTo: mocks.redirect },
  useDidShow: (callback: () => void) => { mocks.show = callback; useEffect(callback, []); },
  useDidHide: (callback: () => void) => { mocks.hide = callback; },
}));
vi.mock('../src/services/account', () => ({ getAddresses: mocks.addresses }));
vi.mock('../src/services/auth-flow', () => ({ requireLogin: () => true }));
vi.mock('../src/services/checkout', () => ({ confirmCheckout: mocks.confirm, computeCheckout: mocks.compute, createOrder: mocks.create }));
import { useCheckout } from '../src/state/checkout';
import type { CheckoutPrice } from '../src/services/checkout';
let state: ReturnType<typeof useCheckout> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useCheckout({ cartIds: 'cart1', returnUrl: '/pages/order/confirm?cartIds=cart1' }); return null; }
function AgainProbe() { state = useCheckout({ cartIds: 'cart1', direct: true, returnUrl: '/pages/order/confirm?cartIds=cart1&new=1' }); return null; }
function PinkProbe() { state = useCheckout({ cartIds: 'cart1', direct: true, pinkId: '33', returnUrl: '/pages/order/confirm?cartIds=cart1&new=1&pinkId=33' }); return null; }
const quote = (payable: number): CheckoutPrice => ({ total: 100, payable, postage: 0, coupon: 0, integral: 0 });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.token = 'account-a';
  mocks.hide = () => {};
  mocks.addresses.mockResolvedValue([{ id: 9, is_default: 1 }]);
  mocks.confirm.mockResolvedValue({ key: 'stable-key', direct: false, items: [], activity: {} });
  mocks.compute.mockResolvedValue(quote(100));
  mocks.create.mockResolvedValue({ id: 'wx-order' });
});
for (const change of ['switch', 'logout', 'hide', 'hide-show', 'unmount'] as const) {
  for (const outcome of ['success', 'failure'] as const) {
    it(`ignores late order ${outcome} after ${change}`, async () => {
      // Given a submitted order whose response has not arrived.
      let finish: (() => void) | undefined;
      mocks.create.mockImplementationOnce(() => new Promise<{ id: string }>((resolve, reject) => {
        finish = () => outcome === 'success' ? resolve({ id: 'stale-order' }) : reject(new Error('stale-failure'));
      }));
      await act(async () => { page = TestRenderer.create(<Probe />); });
      await act(async () => { void state?.submit(); });
      // When the account or page lifetime changes before the response.
      await act(async () => {
        switch (change) {
          case 'switch': mocks.token = 'account-b'; break;
          case 'logout': mocks.token = ''; break;
          case 'hide': mocks.hide(); break;
          case 'hide-show': mocks.hide(); mocks.show(); break;
          case 'unmount': page?.unmount(); break;
        }
        finish?.();
      });
      // Then no old navigation or error escapes into the current page.
      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(state?.error).toBe('');
      if (change !== 'unmount') expect(state?.submitting).toBe(false);
    });
  }
}
for (const change of ['switch', 'hide'] as const) {
  for (const outcome of ['existing', 'failure', 'price'] as const) {
    it(`ignores late checkout recovery ${outcome} after ${change}`, async () => {
      // Given a pending price/recovery request.
      let finish: (() => void) | undefined;
      mocks.compute.mockImplementationOnce(() => new Promise((resolve, reject) => {
        finish = () => outcome === 'failure' ? reject(new Error('stale-recovery')) : resolve(outcome === 'existing' ? { existingOrderId: 'stale-order' } : quote(75));
      }));
      await act(async () => { page = TestRenderer.create(<Probe />); });
      // When the response belongs to a previous account or page lifetime.
      await act(async () => { if (change === 'switch') mocks.token = 'account-b'; else mocks.hide(); finish?.(); });
      // Then it cannot navigate, report an old error, or publish an old quote.
      expect(mocks.redirect).not.toHaveBeenCalled();
      expect(state?.error).toBe('');
      expect(state?.price).toBeUndefined();
    });
  }
}
afterEach(() => { act(() => page?.unmount()); state = undefined; });
it('retains the chosen group after a delivery refresh and submits it to order creation', async () => {
  mocks.confirm.mockResolvedValue({ key: 'stable-key', direct: true, items: [], activity: { combinationId: 8 } });
  await act(async () => { page = TestRenderer.create(<PinkProbe />); });
  await act(async () => { state?.setPreferences((current) => ({ ...current, mark: '参团' })); });
  await act(async () => { await state?.submit(); });
  expect(mocks.compute).toHaveBeenLastCalledWith(expect.objectContaining({ pinkId: 33 }));
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ pinkId: 33 }));
});
it('confirms repeat purchases as temporary carts', async () => {
  await act(async () => { page = TestRenderer.create(<AgainProbe />); });
  expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ cartIds: 'cart1', direct: true }));
});
it('keeps the submission lock across hide/show until the old request settles, then permits retry', async () => {
  // Given an order request pending when the page is hidden and shown again.
  let finish: (() => void) | undefined;
  mocks.create.mockImplementationOnce(() => new Promise<{ id: string }>((resolve) => { finish = () => resolve({ id: 'old-order' }); }));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { void state?.submit(); mocks.hide(); mocks.show(); });
  // When a repeated click happens before the old response settles.
  await act(async () => { await state?.submit(); });
  expect(mocks.create).toHaveBeenCalledTimes(1);
  await act(async () => { finish?.(); });
  expect(mocks.redirect).not.toHaveBeenCalled();
  // Then a current submission can complete without changing the confirmed key.
  await act(async () => { await state?.submit(); });
  expect(mocks.create.mock.calls.map((call) => call[0].key)).toEqual(['stable-key', 'stable-key']);
  expect(mocks.redirect).toHaveBeenCalledWith({ url: '/pages/order/pay?orderId=wx-order' });
});
it('disables submitting while a new quote is pending and discards an out-of-order quote', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  let older: ((value: CheckoutPrice) => void) | undefined;
  mocks.compute.mockImplementationOnce(() => new Promise<CheckoutPrice>((resolve) => { older = resolve; }));
  await act(async () => { state?.setPreferences((current) => ({ ...current, couponId: 1 })); });
  expect(state?.price).toBeUndefined();
  await act(async () => { await state?.submit(); });
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.compute.mockResolvedValueOnce(quote(80));
  await act(async () => { state?.setPreferences((current) => ({ ...current, couponId: 2 })); });
  await act(async () => { older?.(quote(90)); });
  expect(state?.price?.payable).toBe(80);
});
it('prevents rapid duplicate submissions before the first response arrives', async () => {
  let finish: ((value: { id: string }) => void) | undefined;
  mocks.create.mockImplementationOnce(() => new Promise<{ id: string }>((resolve) => { finish = resolve; }));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { void state?.submit(); void state?.submit(); });
  expect(mocks.create).toHaveBeenCalledTimes(1);
  await act(async () => { finish?.({ id: 'wx-order' }); });
  expect(mocks.redirect).toHaveBeenCalledWith({ url: '/pages/order/pay?orderId=wx-order' });
});
it('reuses the confirmed key after an uncertain create response', async () => {
  mocks.create.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce({ id: 'existing-order' });
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.submit(); });
  await act(async () => { state?.retry(); });
  await act(async () => { await state?.submit(); });
  expect(mocks.confirm).toHaveBeenCalledTimes(1);
  expect(mocks.create.mock.calls.map((call) => call[0].key)).toEqual(['stable-key', 'stable-key']);
});
it('navigates to an existing order when retrying discovers creation already succeeded', async () => {
  mocks.create.mockRejectedValueOnce(new Error('timeout'));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.submit(); });
  mocks.compute.mockResolvedValueOnce({ existingOrderId: 'wx-created' });
  await act(async () => { state?.retry(); });
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.redirect).toHaveBeenCalledWith({ url: '/pages/order/pay?orderId=wx-created' });
  expect(state?.price).toBeUndefined();
});
it('does not create a pickup order without a selected store and contact details', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { state?.setPreferences((current) => ({ ...current, shippingType: 2 })); });
  await act(async () => { await state?.submit(); });
  expect(mocks.create).not.toHaveBeenCalled();
  expect(state?.error).toContain('自提门店');
});
