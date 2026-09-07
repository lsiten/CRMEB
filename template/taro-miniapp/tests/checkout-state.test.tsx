import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), compute: vi.fn(), create: vi.fn(), redirect: vi.fn(), addresses: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: { getStorageSync: () => 9, redirectTo: mocks.redirect }, useDidShow: (callback: () => void) => useEffect(callback, []) }));
vi.mock('../src/services/account', () => ({ getAddresses: mocks.addresses }));
vi.mock('../src/services/auth-flow', () => ({ requireLogin: () => true }));
vi.mock('../src/services/checkout', () => ({ confirmCheckout: mocks.confirm, computeCheckout: mocks.compute, createOrder: mocks.create }));
import { useCheckout } from '../src/state/checkout';
import type { CheckoutPrice } from '../src/services/checkout';
let state: ReturnType<typeof useCheckout> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useCheckout({ cartIds: 'cart1', returnUrl: '/pages/order/confirm?cartIds=cart1' }); return null; }
function AgainProbe() { state = useCheckout({ cartIds: 'cart1', direct: true, returnUrl: '/pages/order/confirm?cartIds=cart1&new=1' }); return null; }
const quote = (payable: number): CheckoutPrice => ({ total: 100, payable, postage: 0, coupon: 0, integral: 0 });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.addresses.mockResolvedValue([{ id: 9, is_default: 1 }]);
  mocks.confirm.mockResolvedValue({ key: 'stable-key', direct: false, items: [], activity: {} });
  mocks.compute.mockResolvedValue(quote(100));
  mocks.create.mockResolvedValue({ id: 'wx-order' });
});
afterEach(() => { act(() => page?.unmount()); state = undefined; });
it('confirms repeat purchases as temporary carts', async () => {
  await act(async () => { page = TestRenderer.create(<AgainProbe />); });
  expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ cartIds: 'cart1', direct: true }));
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
