import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), cashier: vi.fn(), request: vi.fn(), launch: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: {}, useDidShow: (callback: () => void) => useEffect(callback, []), useDidHide: () => undefined }));
vi.mock('../src/services/auth-flow', () => ({ requireLogin: () => true }));
vi.mock('../src/services/payment', () => ({ getCashier: mocks.cashier, queryPayment: mocks.query, requestPayment: mocks.request }));
vi.mock('../src/services/payment-launch', () => ({ launchPayment: mocks.launch, paymentCancelled: (error: unknown) => error instanceof Error && error.message === 'cancel' }));
import { usePayment } from '../src/state/payment';
let state: ReturnType<typeof usePayment> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = usePayment('old-order'); return null; }
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('TARO_ENV', 'weapp');
  mocks.query.mockResolvedValue({ status: 'pending' });
  mocks.cashier.mockResolvedValue({ amount: 100, balance: 200, expiresAt: Date.now() / 1000 + 3600, methods: ['balance'] });
  mocks.request.mockResolvedValue({ orderId: 'new-order', status: 'SUCCESS' });
  mocks.launch.mockResolvedValue({ redirected: false });
});
afterEach(() => { act(() => page?.unmount()); state = undefined; vi.unstubAllEnvs(); });
it('queries the reassigned order number and waits for authoritative payment', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  mocks.query.mockResolvedValueOnce({ status: 'paid' });
  await act(async () => { await state?.pay(); });
  expect(mocks.query).toHaveBeenLastCalledWith('new-order');
  expect(state?.orderId).toBe('new-order');
  expect(state?.status).toBe('paid');
});
it('does not interpret a successful client launch as a paid order', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.pay(); });
  expect(state?.status).toBe('pending');
  expect(state?.confirming).toBe(true);
  await act(async () => { await state?.pay(); });
  expect(mocks.request).toHaveBeenCalledTimes(1);
});
it('preserves cancellation feedback and permits another attempt', async () => {
  mocks.launch.mockRejectedValueOnce(new Error('cancel'));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.pay(); });
  expect(state?.notice).toContain('已取消支付');
  expect(state?.error).toBe('');
  expect(state?.status).toBe('pending');
  await act(async () => { await state?.pay(); });
  expect(mocks.request).toHaveBeenLastCalledWith({ orderId: 'new-order', method: 'balance' });
});
it('shows query failure and recovers on an explicit refresh', async () => {
  mocks.query.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  expect(state?.error).not.toBe('');
  await act(async () => { await state?.refresh(); });
  expect(state?.error).toBe('');
  expect(state?.method).toBe('balance');
});
