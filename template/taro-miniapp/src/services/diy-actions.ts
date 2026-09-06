import { getToken, request } from './api';

export type Reward = Readonly<{ kind: 'sign' }> | Readonly<{ kind: 'coupon'; couponId: number }>;
export class RewardError extends Error {}
export async function claimReward(reward: Reward): Promise<void> {
  if (!getToken()) throw new RewardError('请先登录后再操作');
  if (reward.kind === 'coupon' && (!Number.isSafeInteger(reward.couponId) || reward.couponId <= 0)) throw new RewardError('优惠券信息不完整');
  let payload: unknown;
  switch (reward.kind) {
    case 'sign': payload = await request('/sign/integral', { method: 'POST' }); break;
    case 'coupon': payload = await request('/coupon/receive', { method: 'POST', data: { couponId: reward.couponId } }); break;
    default: { const exhaustive: never = reward; return exhaustive; }
  }
  if (payload && typeof payload === 'object' && 'status' in payload && (payload.status === 200 || payload.status === 0)) return;
  throw new RewardError(payload && typeof payload === 'object' && 'msg' in payload && typeof payload.msg === 'string' ? payload.msg : '操作结果未确认，请重试');
}
