import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { computeCheckout, createOrder } from '../src/services/checkout';
import { getBargain, getPink, startBargain, helpBargain } from '../src/services/social-transactions';
const respond = (data: unknown) => ({ statusCode: 200, data: { status: 200, data } });
const bargain = { bargain: { id: 12, product_id: 5, title: '砍价商品', price: '9.90', min_price: '0.00', status: 1, product_is_show: 1, start_time: 1, stop_time: 4102444800, attr: { quota: 2, product_stock: 2 } }, userInfo: { uid: 7 }, userBargainInfo: { bargainType: 6, price: 0, alreadyPrice: '90.10', status: 1 } };
beforeEach(() => vi.clearAllMocks());
it('carries an existing group into both computation and creation without client amounts', async () => {
  // Given a confirmed group cart, when computing and creating, then preserve its group identity.
  const input = { key: 'key', direct: true, pinkId: 33, activity: { combinationId: 8, seckill_id: 0, bargainId: 0, advanceId: 0 }, preferences: { addressId: 9, shippingType: 1 as const, couponId: 0, useIntegral: false, mark: '' } };
  platform.request.mockResolvedValueOnce(respond({ status: 'NONE', result: { total_price: 10, pay_price: 10, pay_postage: 0, coupon_price: 0, deduction_price: 0 } })).mockResolvedValueOnce(respond({ status: 'SUCCESS', result: { orderId: 'order' } }));
  await computeCheckout(input); await createOrder(input);
  for (const call of platform.request.mock.calls) {
    expect(call[0].data).toMatchObject({ pinkId: 33, combinationId: 8 });
    expect(call[0].data).not.toHaveProperty('price');
  }
});
it('resolves the current owner before loading their bargain state', async () => {
  // Given no owner in a catalog link, when loading, then query the authenticated uid explicitly.
  platform.request.mockResolvedValue(respond(bargain));
  expect(await getBargain(12)).toMatchObject({ ownerId: 7, viewerId: 7, action: 'buy', remaining: 0, price: 9.9 });
  expect(platform.request.mock.calls.map((call) => call[0].data)).toEqual([{ bargainUid: 0 }, { bargainUid: 7 }]);
});
it('does not permit buying another user bargain despite a contradictory server action', async () => {
  platform.request.mockResolvedValue(respond(bargain));
  expect(await getBargain(12, 8)).toMatchObject({ action: 'unavailable' });
});
it('sends the existing start and helper payloads and parses cut amounts', async () => {
  platform.request.mockResolvedValue(respond({ price: '1.20' }));
  expect(await startBargain(12)).toBe(1.2);
  expect(await helpBargain(12, 8)).toBe(1.2);
  expect(platform.request.mock.calls.map((call) => call[0].data)).toEqual([{ bargainId: 12 }, { bargainId: 12, bargainUserUid: 8 }]);
});
it.each([
  [1, 7, 0, 10, 'start'], [2, 7, 1, 10, 'invite'], [3, 8, 1, 10, 'help'],
  [4, 8, 1, 0, 'complete'], [5, 8, 1, 10, 'helped'], [6, 7, 1, 0, 'buy'],
  [6, 7, 3, 0, 'unavailable'], [6, 7, 1, 10, 'unavailable'], [99, 7, 1, 0, 'unavailable'],
] as const)('maps server action %i for owner %i and status %i safely', async (bargainType, ownerId, status, price, action) => {
  platform.request.mockResolvedValue(respond({ ...bargain, userBargainInfo: { ...bargain.userBargainInfo, bargainType, status, price } }));
  expect(await getBargain(12, ownerId)).toMatchObject({ action });
});
it.each([-1, 0, NaN, 1.5])('rejects invalid owner %s before a mutation', async (owner) => {
  await expect(helpBargain(12, owner)).rejects.toThrow();
  expect(platform.request).not.toHaveBeenCalled();
});
it('surfaces business errors without retrying a mutation', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 400, msg: '已助力过该活动' } });
  await expect(helpBargain(12, 8)).rejects.toThrow('已助力过该活动');
  expect(platform.request).toHaveBeenCalledTimes(1);
});
it.each([{ status: 2 }, { stop_time: 1 }, { userBool: 1 }, { count: 0 }])('disallows completed, expired, joined or full groups %j', async (override) => {
  const data = { pinkT: { id: 33, status: 1, stop_time: 4102444800, ...override }, userBool: 0, is_ok: 0, pinkBool: 0, count: 1, store_combination: { id: 8, product_id: 5, title: '拼团', price: 10, productValue: { 标准: { unique: 'sku', price: 10, stock: 2, quota: 2, product_stock: 2 } } }, ...override };
  platform.request.mockResolvedValue(respond(data));
  expect(await getPink(33)).toMatchObject({ joinable: false });
});
