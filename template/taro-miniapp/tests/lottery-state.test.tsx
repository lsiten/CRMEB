import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ getReviewLottery: vi.fn(), getLotteryActivity: vi.fn(), drawLottery: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ useDidShow: (fn: () => void) => useEffect(fn, []) }));
vi.mock('../src/services/lottery', async (original) => ({ ...await original<typeof import('../src/services/lottery')>(), ...api }));
import { LotteryDrawError, LotterySubscriptionError } from '../src/services/lottery';
import { useReviewLottery, useLottery } from '../src/state/lottery';
let state: ReturnType<typeof useReviewLottery> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useReviewLottery(); return null; }
const activity = { id: '2', name: '活动', chances: 1, prizes: [], factor: 4, cost: 0, image: '', rules: '', showPublicWinners: false, showPersonalWinners: false, publicNoticeWinners: [], publicWinners: [], personalWinners: [] };
beforeEach(() => { vi.clearAllMocks(); api.getReviewLottery.mockResolvedValue(activity); });
afterEach(() => act(() => page?.unmount()));
it('prevents simultaneous draws while the first outcome is pending', async () => {
  let resolve: ((value: unknown) => void) | undefined;
  api.drawLottery.mockImplementation(() => new Promise((done) => { resolve = done; }));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { void state?.draw(); void state?.draw(); });
  expect(api.drawLottery).toHaveBeenCalledTimes(1);
  await act(async () => { resolve?.({ id: '9', type: 1, recordId: '3' }); });
});
function GeneralProbe() { state = useLottery({ factor: 3, activityId: '72' }); return null; }
it('uses the response qualification when drawing an explicitly selected activity', async () => {
  // Given
  api.getLotteryActivity.mockResolvedValue({ ...activity, id: '72', factor: 5 });
  api.drawLottery.mockRejectedValue(new LotterySubscriptionError('/subscribe.png'));
  await act(async () => { page = TestRenderer.create(<GeneralProbe />); });
  // When
  await act(async () => { await state?.draw(); });
  // Then
  expect(api.getLotteryActivity).toHaveBeenCalledWith(3, '72');
  expect(api.drawLottery).toHaveBeenCalledWith('72', 5);
  expect(state).toMatchObject({ phase: 'subscribe', subscriptionImage: '/subscribe.png', result: undefined });
});
it('requires closing the subscription challenge before retrying', async () => {
  // Given
  api.getLotteryActivity.mockResolvedValue({ ...activity, id: '72', factor: 5 });
  api.drawLottery.mockRejectedValue(new LotterySubscriptionError('/subscribe.png'));
  await act(async () => { page = TestRenderer.create(<GeneralProbe />); });
  await act(async () => { await state?.draw(); });
  // When
  await act(async () => { await state?.draw(); });
  // Then
  expect(api.drawLottery).toHaveBeenCalledTimes(1);
});
it('clears the challenge and refreshes eligibility on dismissal', async () => {
  // Given
  api.getLotteryActivity.mockResolvedValue({ ...activity, id: '72', factor: 5 });
  api.drawLottery.mockRejectedValue(new LotterySubscriptionError('/subscribe.png'));
  await act(async () => { page = TestRenderer.create(<GeneralProbe />); });
  await act(async () => { await state?.draw(); });
  // When
  await act(async () => { await state?.dismiss(); });
  // Then
  expect(state).toMatchObject({ phase: 'idle', subscriptionImage: '', error: '' });
});
it('blocks retry after an uncertain result until the user refreshes eligibility', async () => {
  api.drawLottery.mockRejectedValue(new LotteryDrawError('timeout', true));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.draw(); });
  expect(state?.phase).toBe('uncertain');
  await act(async () => { await state?.draw(); });
  expect(api.drawLottery).toHaveBeenCalledTimes(1);
});
it('does not draw with zero server chances', async () => {
  api.getReviewLottery.mockResolvedValue({ ...activity, chances: 0 });
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.draw(); });
  expect(api.drawLottery).not.toHaveBeenCalled();
});
it('retains a confirmed prize even when refreshing remaining chances fails', async () => {
  api.drawLottery.mockResolvedValue({ id: '9', type: 6, recordId: '321', name: '礼盒' });
  await act(async () => { page = TestRenderer.create(<Probe />); });
  api.getReviewLottery.mockRejectedValue(new Error('offline'));
  await act(async () => { await state?.draw(); });
  expect(state?.result).toMatchObject({ recordId: '321', type: 6 });
  expect(state?.phase).toBe('result');
});
it('requires dismissing a confirmed result before another draw', async () => {
  api.drawLottery.mockResolvedValue({ id: '9', type: 1, recordId: '321' });
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.draw(); await state?.draw(); });
  expect(api.drawLottery).toHaveBeenCalledTimes(1);
});
