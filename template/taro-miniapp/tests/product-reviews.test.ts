import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => '', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getProductReviews, getReviewSummary } from '../src/services/product-reviews';
beforeEach(() => vi.clearAllMocks());
const respond = (data: unknown) => platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data } });
it('loads server review counts and percentages when numeric strings are returned', async () => {
  respond({ sum_count: '22', good_count: 20, in_count: 1, poor_count: 1, reply_star: '4', reply_chance: '90' });
  await expect(getReviewSummary('7')).resolves.toEqual({ total: 22, good: 20, normal: 1, poor: 1, score: 4, positiveRate: 90 });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/reply/config/7') }));
});
it('preserves review metadata and photo order when loading a filtered page', async () => {
  respond([{ id: 81, nickname: '用***户', avatar: '/avatar.png', star: '4', add_time: '昨天', suk: '250g', comment: '口味不错', pics: ['/a.png', '/b.png'], is_money_level: 1, merchant_reply_content: '谢谢支持' }]);
  await expect(getProductReviews('7', 2, 3)).resolves.toEqual([{ id: '81', nickname: '用***户', avatar: '/avatar.png', score: 4, createdAt: '昨天', spec: '250g', comment: '口味不错', images: ['/a.png', '/b.png'], member: true, merchantReply: '谢谢支持' }]);
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/reply/list/7'), data: { page: 3, limit: 20, type: 2 } }));
});
it('accepts an empty result when the server has no reviews', async () => {
  respond([]);
  await expect(getProductReviews('7', 0, 1)).resolves.toEqual([]);
});
it('rejects malformed counts instead of presenting a fake zero summary', async () => {
  respond({ sum_count: 'broken' });
  await expect(getReviewSummary('7')).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('rejects invalid scores instead of rendering misleading stars', async () => {
  respond([{ id: 1, star: 9, pics: [] }]);
  await expect(getProductReviews('7', 0, 1)).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('rejects invalid product parameters before making a request', async () => {
  await expect(getProductReviews('', 0, 1)).rejects.toBeDefined();
  expect(platform.request).not.toHaveBeenCalled();
});
it('surfaces backend failure instead of converting it to an empty review list', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 400, msg: '暂不可用' } });
  await expect(getProductReviews('7', 0, 1)).rejects.toMatchObject({ code: 'BUSINESS' });
});
