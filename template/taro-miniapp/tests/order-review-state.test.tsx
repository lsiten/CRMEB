import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ product: vi.fn(), submit: vi.fn(), upload: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: {}, useDidShow: (callback: () => void) => useEffect(callback, []) }));
vi.mock('../src/services/order-reviews', () => ({ getReviewProduct: mocks.product, submitOrderReview: mocks.submit }));
vi.mock('../src/services/image-upload', () => ({ chooseAndUploadImage: mocks.upload }));
import { useOrderReview } from '../src/state/order-review';
let state: ReturnType<typeof useOrderReview> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useOrderReview('line81'); return null; }
beforeEach(() => { vi.clearAllMocks(); mocks.product.mockResolvedValue({ unique: 'line81', orderId: 'order81', name: '咖啡' }); mocks.submit.mockResolvedValue({ lotteryAvailable: false }); });
afterEach(() => { act(() => page?.unmount()); state = undefined; });
async function fill() {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { state?.setComment('包装完整'); state?.setProductScore(4); state?.setServiceScore(5); });
}
it('retains text and ratings after a rejected review', async () => {
  mocks.submit.mockRejectedValueOnce(new Error('network'));
  await fill();
  await act(async () => { await state?.submit(); });
  expect(state?.result).toBeUndefined();
  expect(state?.comment).toBe('包装完整');
  expect(state?.productScore).toBe(4);
  expect(state?.serviceScore).toBe(5);
  expect(state?.error).not.toBe('');
});
it('does not submit until the upload acknowledges and passes the server image URL', async () => {
  await fill();
  let finish: ((url: string) => void) | undefined;
  mocks.upload.mockImplementationOnce(() => new Promise<string>((resolve) => { finish = resolve; }));
  await act(async () => { void state?.attachments.choose(); await state?.submit(); });
  expect(mocks.submit).not.toHaveBeenCalled();
  await act(async () => { finish?.('https://example.test/proof.png'); });
  await act(async () => { await state?.submit(); });
  expect(mocks.submit).toHaveBeenCalledWith({ unique: 'line81', comment: '包装完整', productScore: 4, serviceScore: 5, images: ['https://example.test/proof.png'] });
});
it('prevents rapid duplicate and already completed submissions', async () => {
  await fill();
  let finish: ((result: { lotteryAvailable: boolean }) => void) | undefined;
  mocks.submit.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await act(async () => { void state?.submit(); void state?.submit(); });
  expect(mocks.submit).toHaveBeenCalledTimes(1);
  await act(async () => { finish?.({ lotteryAvailable: true }); });
  await act(async () => { await state?.submit(); });
  expect(mocks.submit).toHaveBeenCalledTimes(1);
  expect(state?.result).toEqual({ lotteryAvailable: true });
});
it('cannot submit after a product load failure', async () => {
  mocks.product.mockRejectedValueOnce(new Error('network'));
  await fill();
  await act(async () => { await state?.submit(); });
  expect(mocks.submit).not.toHaveBeenCalled();
});
