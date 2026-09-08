import { beforeEach, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session' }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getMarketingItems, getMarketingPage, getMarketingDetail } from '../src/services/marketing';
const ok = (data: unknown) => ({ statusCode: 200, data: { status: 200, data } });
beforeEach(() => vi.clearAllMocks());

it('uses the server selected seckill period from the UniApp response', async () => {
  // Given two periods with the second selected.
  platform.request.mockResolvedValueOnce(ok({ seckillTime: [{ id: 4, time: '08:00', state: '已结束', status: 0 }, { id: 7, time: '10:00', state: '抢购中', status: 1 }], seckillTimeIndex: 1 }))
    .mockResolvedValueOnce(ok([{ id: 12, title: '限时商品', price: '19.90' }]));
  // When the default seckill catalog loads.
  const rows = await getMarketingItems('seckill');
  // Then the correct period is requested and its products are visible.
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/seckill/list/7') }));
  expect(rows).toMatchObject([{ id: 12, price: 19.9 }]);
});

it('requests the exact page and retains explicit hasMore for a full page', async () => {
  // Given twenty activities, when requesting page two, then pagination is not truncated.
  platform.request.mockResolvedValue(ok(Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: '活动', price: '5' }))));
  await expect(getMarketingPage('combination', 2)).resolves.toMatchObject({ hasMore: true });
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: { page: 2, limit: 20 } }));
});

it('reads seckill storeInfo and sends the selected time_id for detail', async () => {
  // Given a UniApp detail envelope, when entering a period's activity, then retain that period.
  platform.request.mockResolvedValue(ok({ storeInfo: { id: 12, product_id: 6, title: '限时商品', price: '19.90' } }));
  await expect(getMarketingDetail('seckill', 12, 7)).resolves.toMatchObject({ id: 12, productId: 6 });
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: { time_id: 7 } }));
});

it('retains activity SKU identity and status for direct checkout', async () => {
  // Given activity-specific variants, when loading detail, then do not substitute ordinary product SKUs.
  platform.request.mockResolvedValue(ok({ storeInfo: { id: 12, product_id: 6, title: '拼团', price: '19.90', is_show: 1 }, productValue: { '红色': { unique: 'activity-red', price: '18.90', stock: 3 } } }));
  await expect(getMarketingDetail('combination', 12)).resolves.toMatchObject({ activityStatus: 1, variants: [{ unique: 'activity-red', label: '红色', price: 18.9, stock: 3 }] });
});

it('rejects malformed seckill configuration instead of reporting no activity', async () => {
  // Given an invalid success payload, when loading, then expose a recoverable error.
  platform.request.mockResolvedValueOnce(ok({}));
  await expect(getMarketingItems('seckill')).rejects.toThrow();
});
