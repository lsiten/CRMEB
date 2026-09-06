import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';
const api = vi.hoisted(() => ({ getToken: vi.fn(() => 'token'), request: vi.fn().mockResolvedValue({ status: 200 }) }));
const toast = vi.hoisted(() => vi.fn().mockResolvedValue({}));
vi.mock('../src/services/api', () => api);
vi.mock('@tarojs/taro', () => ({ default: { showToast: toast } }));
vi.mock('@tarojs/components', () => ({ Text: 'span', View: 'div' }));
import { RewardAction } from '../src/diy/reward-actions';
beforeEach(() => { vi.clearAllMocks(); api.getToken.mockReturnValue('token'); });
it.each([{ kind: 'sign' }, { kind: 'coupon', couponId: 12 }] as const)('submits a real $kind reward and marks it complete', async (reward) => {
  const root = TestRenderer.create(<RewardAction reward={reward} />).root;
  await act(async () => { await root.findByType('span').props.onClick(); });
  expect(api.request).toHaveBeenCalledWith(reward.kind === 'sign' ? '/sign/integral' : '/coupon/receive', reward.kind === 'sign' ? { method: 'POST' } : { method: 'POST', data: { couponId: 12 } });
  expect(root.findByType('span').props['aria-disabled']).toBe(true);
});
it('requires login before sending a reward request', async () => {
  api.getToken.mockReturnValue('');
  const root = TestRenderer.create(<RewardAction reward={{ kind: 'sign' }} />).root;
  await act(async () => { await root.findByType('span').props.onClick(); });
  expect(api.request).not.toHaveBeenCalled();
  expect(toast).toHaveBeenCalledWith({ title: '请先登录后再操作', icon: 'none' });
});
it('keeps failed requests retryable', async () => {
  api.request.mockResolvedValueOnce({ status: 400, msg: '领取失败' });
  const root = TestRenderer.create(<RewardAction reward={{ kind: 'coupon', couponId: 12 }} />).root;
  await act(async () => { await root.findByType('span').props.onClick(); });
  expect(root.findByType('span').props['aria-disabled']).toBe(false);
});
it.each([null, {}, { status: '200' }, { status: 500 }])('rejects an unconfirmed response %j', async (payload) => {
  api.request.mockResolvedValueOnce(payload);
  const root = TestRenderer.create(<RewardAction reward={{ kind: 'sign' }} />).root;
  await act(async () => { await root.findByType('span').props.onClick(); });
  expect(root.findByType('span').props['aria-disabled']).toBe(false);
  expect(toast).toHaveBeenCalledWith(expect.objectContaining({ icon: 'none' }));
});
it('retries a failed claim successfully', async () => {
  api.request.mockRejectedValueOnce(new Error('网络失败'));
  const root = TestRenderer.create(<RewardAction reward={{ kind: 'sign' }} />).root;
  await act(async () => { await root.findByType('span').props.onClick(); });
  await act(async () => { await root.findByType('span').props.onClick(); });
  expect(api.request).toHaveBeenCalledTimes(2);
  expect(root.findByType('span').props['aria-disabled']).toBe(true);
});
it('does not repeat a completed claim', async () => {
  const root = TestRenderer.create(<RewardAction reward={{ kind: 'sign' }} />).root;
  await act(async () => { await root.findByType('span').props.onClick(); });
  await act(async () => { await root.findByType('span').props.onClick(); });
  expect(api.request).toHaveBeenCalledTimes(1);
});
it('prevents repeated clicks while the request is pending', async () => {
  let resolve: ((value: { status: number }) => void) | undefined;
  api.request.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
  const root = TestRenderer.create(<RewardAction reward={{ kind: 'sign' }} />).root;
  await act(async () => {
    const first = root.findByType('span').props.onClick();
    const second = root.findByType('span').props.onClick();
    resolve?.({ status: 200 });
    await Promise.all([first, second]);
  });
  expect(api.request).toHaveBeenCalledTimes(1);
});
