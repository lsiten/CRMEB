import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ getMerchantTransfer: vi.fn(), launchMerchantTransfer: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: {}, useDidShow: (fn: () => void) => useEffect(fn, []) }));
vi.mock('../src/services/merchant-transfer', async (original) => ({ ...await original<typeof import('../src/services/merchant-transfer')>(), getMerchantTransfer: api.getMerchantTransfer }));
vi.mock('../src/services/transfer-launch', async (original) => ({ ...await original<typeof import('../src/services/transfer-launch')>(), launchMerchantTransfer: api.launchMerchantTransfer }));
import { useMerchantTransfer } from '../src/state/merchant-transfer';
import { TransferLaunchError } from '../src/services/transfer-launch';
let state: ReturnType<typeof useMerchantTransfer> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
const pending = { orderId: 'hb321', kind: 2, state: 'WAIT_USER_CONFIRM', amount: 8.88 };
function Probe() { state = useMerchantTransfer('hb321', 2); return null; }
beforeEach(() => { vi.clearAllMocks(); api.getMerchantTransfer.mockResolvedValue(pending); api.launchMerchantTransfer.mockResolvedValue(undefined); });
afterEach(() => act(() => page?.unmount()));
it('does not promote a successful platform callback into server success', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.confirm(); });
  expect(state?.data?.state).toBe('WAIT_USER_CONFIRM');
  expect(api.getMerchantTransfer).toHaveBeenCalledTimes(2);
});
it('shows received only after the server query returns SUCCESS', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  api.getMerchantTransfer.mockResolvedValue({ ...pending, state: 'SUCCESS' });
  await act(async () => { await state?.confirm(); });
  expect(state?.data?.state).toBe('SUCCESS');
});
it('prevents duplicate launch while waiting for the platform callback', async () => {
  let release: (() => void) | undefined;
  api.launchMerchantTransfer.mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { void state?.confirm(); void state?.confirm(); });
  expect(api.launchMerchantTransfer).toHaveBeenCalledTimes(1);
  await act(async () => { release?.(); });
});
it('retains server state and allows retry after user cancellation', async () => {
  api.launchMerchantTransfer.mockRejectedValue(new TransferLaunchError('cancelled', true));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.confirm(); });
  expect(state?.data?.state).toBe('WAIT_USER_CONFIRM');
  expect(state?.launching).toBe(false);
});
it('keeps query failures visible and blocks relaunch until refreshed', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  api.getMerchantTransfer.mockRejectedValue(new Error('offline'));
  await act(async () => { await state?.confirm(); });
  await act(async () => { await state?.confirm(); });
  expect(state?.error).not.toBe('');
  expect(api.launchMerchantTransfer).toHaveBeenCalledTimes(1);
});
it('does not launch an already successful receipt', async () => {
  api.getMerchantTransfer.mockResolvedValue({ ...pending, state: 'SUCCESS' });
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.confirm(); });
  expect(api.launchMerchantTransfer).not.toHaveBeenCalled();
});
