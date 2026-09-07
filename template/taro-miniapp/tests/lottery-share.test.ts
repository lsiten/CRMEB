import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: vi.fn(), removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getLotteryShare } from '../src/services/lottery-share';
const activity = { id: '72', factor: 5, name: '幸运礼遇', image: '/static/banner.png' } as const;
beforeEach(() => {
  vi.clearAllMocks();
  platform.getStorageSync.mockReturnValue('fixture-session');
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { uid: 42 } } });
});

it('uses the server activity and current authenticated user in a mini-program share', async () => {
  // Given / When
  const share = await getLotteryShare(activity);
  // Then
  expect(share).toEqual({ title: '幸运礼遇', path: '/pages/marketing/lottery?type=5&lottery_id=72&spread=42', imageUrl: '/static/banner.png' });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/userinfo') }));
});
it('replaces stale referral and private URL parameters while retaining the H5 deployment path', async () => {
  // Given / When
  const share = await getLotteryShare(activity, 'https://name:password@shop.example/store/index.html?token=secret&code=oauth#/pages/marketing/index?kind=lottery&spread=7');
  // Then
  expect(share.url).toBe('https://shop.example/store/index.html#/pages/marketing/lottery?type=5&lottery_id=72&spread=42');
  expect(share.imageUrl).toBe('https://shop.example/static/banner.png');
});
it('requires login before preparing a user-attributed invitation', async () => {
  // Given
  platform.getStorageSync.mockReturnValue(undefined);
  // When / Then
  await expect(getLotteryShare(activity)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  expect(platform.request).not.toHaveBeenCalled();
});
it.each([null, { uid: 0 }, { uid: 'wrong' }, { uid: 1000000001 }])('rejects missing or invalid user identifiers: %j', async (profile) => {
  // Given
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: profile } });
  // When / Then
  await expect(getLotteryShare(activity)).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('rejects an invalid activity id instead of sharing the default activity', async () => {
  // Given / When / Then
  await expect(getLotteryShare({ ...activity, id: '../72' })).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('preserves a user lookup failure for an explicit retry', async () => {
  // Given
  platform.request.mockRejectedValue(new Error('isolated transport'));
  // When / Then
  await expect(getLotteryShare(activity)).rejects.toMatchObject({ code: 'NETWORK' });
});
it('does not generate an invitation for an outdated login session', async () => {
  // Given
  let finish: ((value: unknown) => void) | undefined;
  platform.request.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const pending = getLotteryShare(activity);
  platform.getStorageSync.mockReturnValue('new-fixture-session');
  // When
  finish?.({ statusCode: 200, data: { status: 200, data: { uid: 42 } } });
  // Then
  await expect(pending).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
});
it.each(['javascript:alert(1)', 'not-a-url'])('rejects unsupported H5 locations: %s', async (url) => {
  // Given / When / Then
  await expect(getLotteryShare(activity, url)).rejects.toMatchObject({ code: 'BUSINESS' });
});
