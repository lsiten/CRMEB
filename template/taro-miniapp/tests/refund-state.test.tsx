import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ products: vi.fn(), reasons: vi.fn(), eligibility: vi.fn(), apply: vi.fn(), upload: vi.fn() }));
vi.mock('../src/services/refunds', () => ({ getRefundProducts: mocks.products, getRefundReasons: mocks.reasons, getRefundEligibility: mocks.eligibility, applyRefund: mocks.apply }));
vi.mock('@tarojs/taro', () => ({ default: {} }));
vi.mock('../src/services/image-upload', () => ({ chooseAndUploadImage: mocks.upload }));
import { useRefundApplication } from '../src/state/refund-application';
let state: ReturnType<typeof useRefundApplication> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useRefundApplication(81); return null; }
async function mountAndChoose() {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { state?.choose('cart81', 1); state?.setReason('商品损坏'); state?.setExplanation('包装破损'); });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.products.mockResolvedValue([{ cartId: 'cart81', name: '咖啡', remaining: 2 }]);
  mocks.reasons.mockResolvedValue(['商品损坏']);
  mocks.eligibility.mockResolvedValue({ allowReturn: true });
  mocks.apply.mockResolvedValue(undefined);
});
afterEach(() => { act(() => page?.unmount()); state = undefined; });
it('waits for refund proof upload and submits only its server URL', async () => {
  await mountAndChoose();
  let finish: ((url: string) => void) | undefined;
  mocks.upload.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve; }));
  await act(async () => { void state?.attachments.choose(); await state?.submit(); });
  expect(mocks.apply).not.toHaveBeenCalled();
  await act(async () => { finish?.('https://example.test/proof.png'); });
  await act(async () => { await state?.submit(); });
  expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({ images: ['https://example.test/proof.png'] }));
});
it('requires explicit product and reason selection', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  expect(state?.selection).toEqual([]);
  expect(state?.reason).toBe('');
  await act(async () => { await state?.submit(); });
  expect(mocks.apply).not.toHaveBeenCalled();
});
it('does not select more than the remaining quantity or fractional quantities', async () => {
  await mountAndChoose();
  await act(async () => { state?.choose('cart81', 3); state?.choose('cart81', 1.5); });
  expect(state?.selection).toEqual([{ cartId: 'cart81', quantity: 1 }]);
});
it('invalidates eligibility when quantity changes and ignores stale responses', async () => {
  let older: ((value: { allowReturn: boolean }) => void) | undefined;
  mocks.eligibility.mockImplementationOnce(() => new Promise<{ allowReturn: boolean }>((resolve) => { older = resolve; }));
  await mountAndChoose();
  expect(state?.ready).toBe(false);
  await act(async () => { state?.choose('cart81', 2); });
  expect(state?.allowReturn).toBe(true);
  await act(async () => { older?.({ allowReturn: false }); });
  expect(state?.allowReturn).toBe(true);
});
it('retains the form after a rejection and prevents duplicate in-flight and completed submissions', async () => {
  mocks.apply.mockRejectedValueOnce(new Error('network'));
  await mountAndChoose();
  await act(async () => { await state?.submit(); });
  expect(state?.submitted).toBe(false);
  expect(state?.explanation).toBe('包装破损');
  let finish: (() => void) | undefined;
  mocks.apply.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  await act(async () => { void state?.submit(); void state?.submit(); state?.choose('cart81', 2); });
  expect(mocks.apply).toHaveBeenCalledTimes(2);
  expect(state?.selection[0]?.quantity).toBe(1);
  await act(async () => { finish?.(); });
  await act(async () => { await state?.submit(); });
  expect(mocks.apply).toHaveBeenCalledTimes(2);
  expect(state?.submitted).toBe(true);
});
it('does not submit unsupported return types or unconfigured reasons', async () => {
  mocks.eligibility.mockResolvedValue({ allowReturn: false });
  await mountAndChoose();
  await act(async () => { state?.setType(2); });
  await act(async () => { await state?.submit(); });
  expect(mocks.apply).not.toHaveBeenCalled();
  await act(async () => { state?.setType(1); state?.setReason('任意理由'); });
  await act(async () => { await state?.submit(); });
  expect(mocks.apply).not.toHaveBeenCalled();
});
it('blocks submission if refreshing the available refund quantity fails', async () => {
  await mountAndChoose();
  mocks.products.mockRejectedValueOnce(new Error('network'));
  await act(async () => { state?.retry(); });
  expect(state?.ready).toBe(false);
  await act(async () => { await state?.submit(); });
  expect(mocks.apply).not.toHaveBeenCalled();
});
