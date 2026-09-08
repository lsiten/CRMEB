import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session' }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getMemberCoupons } from '../src/services/member-coupons';
const ok = (data: unknown) => ({ statusCode: 200, data: { status: 200, data } });
beforeEach(() => vi.clearAllMocks());
it('reads member coupon amounts and server status without inventing usable coupons', async () => {
  // Given expired and future coupons, when parsing, then keep the server status.
  platform.request.mockResolvedValue(ok([
    { id: 3, coupon_title: '会员满减', coupon_price: '20.00', use_min_price: '100', _msg: '已过期', is_fail: 1, applicable_type: 0, add_time: '2026/01/01', end_time: '2026/02/01' },
    { id: 4, coupon_title: '下月专享', coupon_price: 5, use_min_price: 0, _msg: '未开始', applicable_type: 1 },
  ]));
  const rows = await getMemberCoupons();
  expect(rows).toMatchObject([{ id: '3', amount: 20, status: '已过期', scope: '通用券' }, { id: '4', minPrice: 0, status: '未开始', scope: '品类券' }]);
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/user/member/coupons/list'), method: 'GET' }));
});
it.each([{}, null, [{ id: 1, coupon_price: 'bad', use_min_price: 0 }]])('rejects malformed member data %s instead of showing empty/free coupons', async (data) => {
  // Given invalid member data, when parsing, then show a recoverable failure.
  platform.request.mockResolvedValue(ok(data));
  await expect(getMemberCoupons()).rejects.toThrow();
});
