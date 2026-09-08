import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getMarketingItems: vi.fn().mockResolvedValue([]), getMarketingPage: vi.fn(), getSeckillSchedule: vi.fn(), getMemberCoupons: vi.fn(), token: 'session' }));
vi.mock('../src/services/marketing', () => ({ ...api, labels: { seckill: '限时秒杀', combination: '拼团/组合', bargain: '砍价活动' } }));
vi.mock('../src/services/member-coupons', () => ({ getMemberCoupons: api.getMemberCoupons }));
vi.mock('../src/services/api', () => ({ getToken: () => api.token, ApiError: Error }));
vi.mock('../src/components/commerce-image', () => ({ CommerceImage: () => <div /> }));
vi.mock('@tarojs/components', () => ({ Button: 'button', Text: 'span', View: 'div' }));
vi.mock('@tarojs/taro', () => ({ default: { getCurrentInstance: () => ({ router: { params: {} } }), navigateTo: vi.fn(), switchTab: vi.fn() }, useReachBottom: vi.fn(), useDidShow: (cb: () => void) => React.useEffect(cb, []) }));
import CombinationPage from '../src/pages-extra/goods-combination';
import MemberCouponsPage from '../src/pages-extra/vip-coupon';

beforeEach(() => {
  vi.clearAllMocks(); api.token = 'session';
  api.getMarketingPage.mockResolvedValue({ items: [], hasMore: false });
  api.getMemberCoupons.mockResolvedValue([]);
});

it('loads combination data when its dedicated route opens', async () => {
  // Given the combination route, when mounted, then it does not load seckill.
  const page = TestRenderer.create(<CombinationPage />);
  await act(async () => undefined);
  expect(api.getMarketingPage).toHaveBeenCalledWith('combination', 1, undefined);
  page.unmount();
});

it('does not fetch private member coupons for a guest', async () => {
  // Given a guest, when opening member coupons, then offer login without requesting data.
  api.token = '';
  const page = TestRenderer.create(<MemberCouponsPage />);
  await act(async () => undefined);
  expect(api.getMemberCoupons).not.toHaveBeenCalled();
  expect(JSON.stringify(page.toJSON())).toContain('登录后查看会员券');
  page.unmount();
});

it('preserves member coupon failure until retry succeeds', async () => {
  // Given a network failure, when retrying, then only a successful empty result says empty.
  api.getMemberCoupons.mockRejectedValueOnce(new Error('会员券加载失败')).mockResolvedValueOnce([]);
  const page = TestRenderer.create(<MemberCouponsPage />);
  await act(async () => undefined);
  expect(JSON.stringify(page.toJSON())).not.toContain('暂无会员券');
  await act(async () => { await page.root.findByProps({ children: '重试' }).props.onClick(); });
  expect(JSON.stringify(page.toJSON())).toContain('暂无会员券');
  page.unmount();
});
