import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@tarojs/taro', () => ({ default: {} }));
import { registerWechatShare, wechatSignatureUrl, type WechatShareSdk } from '../src/services/wechat-share';
const share = { title: '幸运抽奖', path: '/pages/marketing/lottery', imageUrl: 'https://shop.example/cover.png', url: 'https://shop.example/#/pages/marketing/lottery?type=5&lottery_id=72&spread=42' };
const config = { data: { appId: 'wx-fixture', timestamp: '12345', nonceStr: 'nonce', signature: 'signature' } };
afterEach(() => vi.useRealTimers());
function sdkFixture() {
  let ready: (() => void) | undefined;
  let failed: (() => void) | undefined;
  const sdk = {
    config: vi.fn(), ready: vi.fn((callback: () => void) => { ready = callback; }), error: vi.fn((callback: () => void) => { failed = callback; }),
    updateAppMessageShareData: vi.fn<NonNullable<WechatShareSdk['updateAppMessageShareData']>>(data => data.success?.()),
    updateTimelineShareData: vi.fn<NonNullable<WechatShareSdk['updateTimelineShareData']>>(data => data.success?.()),
    onMenuShareAppMessage: vi.fn(), onMenuShareTimeline: vi.fn(),
  };
  return { sdk, ready: () => ready?.(), fail: () => failed?.() };
}
it('keeps the original iOS entry query for signing, separate from a sanitized shared URL', () => {
  // Given / When / Then
  expect(wechatSignatureUrl('https://shop.example/?new=1#/other', 'https://shop.example/?code=entry#/first', 'iPhone MicroMessenger')).toBe('https://shop.example/?code=entry');
  expect(wechatSignatureUrl('https://shop.example/?new=1#/other', 'https://shop.example/?code=entry#/first', 'Android MicroMessenger')).toBe('https://shop.example/?new=1');
});
it('waits for readiness and registers both current and legacy share menus with the same attribution', async () => {
  // Given
  const fixture = sdkFixture();
  // When
  const operation = registerWechatShare(fixture.sdk, config, share);
  expect(fixture.sdk.updateAppMessageShareData).not.toHaveBeenCalled();
  fixture.ready(); await operation;
  // Then
  for (const method of [fixture.sdk.updateAppMessageShareData, fixture.sdk.updateTimelineShareData, fixture.sdk.onMenuShareAppMessage, fixture.sdk.onMenuShareTimeline]) expect(method).toHaveBeenCalledWith(expect.objectContaining({ title: share.title, desc: share.title, link: share.url, imgUrl: share.imageUrl }));
  expect(fixture.sdk.config).toHaveBeenCalledWith(expect.objectContaining({ timestamp: 12345 }));
  await registerWechatShare(fixture.sdk, config, { ...share, title: '新活动' });
  expect(fixture.sdk.config).toHaveBeenCalledOnce();
});
it('does not apply stale activity metadata after SDK readiness arrives', async () => {
  // Given
  const fixture = sdkFixture();
  const operation = registerWechatShare(fixture.sdk, config, share, () => false);
  // When
  fixture.ready(); await operation;
  // Then
  expect(fixture.sdk.updateAppMessageShareData).not.toHaveBeenCalled();
  expect(fixture.sdk.onMenuShareTimeline).not.toHaveBeenCalled();
});
it('rejects a signature failure without claiming menu readiness', async () => {
  // Given
  const fixture = sdkFixture();
  const operation = registerWechatShare(fixture.sdk, config, share);
  // When
  fixture.fail();
  // Then
  await expect(operation).rejects.toThrow('微信分享配置失败');
  expect(fixture.sdk.updateAppMessageShareData).not.toHaveBeenCalled();
});
it('rejects a modern menu registration failure', async () => {
  // Given
  const fixture = sdkFixture(); fixture.sdk.updateTimelineShareData.mockImplementation(data => data.fail?.());
  const operation = registerWechatShare(fixture.sdk, config, share);
  // When
  fixture.ready();
  // Then
  await expect(operation).rejects.toThrow('微信分享配置失败');
});
it('bounds an SDK that never becomes ready', async () => {
  // Given
  vi.useFakeTimers(); const fixture = sdkFixture();
  const operation = registerWechatShare(fixture.sdk, config, share);
  const rejected = expect(operation).rejects.toThrow('微信分享配置失败');
  // When
  await vi.advanceTimersByTimeAsync(10000);
  // Then
  await rejected;
});
it.each([{}, { data: {} }, { data: { ...config.data, timestamp: 0 } }])('rejects malformed backend configuration %j', async value => {
  // Given / When / Then
  const fixture = sdkFixture();
  await expect(registerWechatShare(fixture.sdk, value, share)).rejects.toThrow('微信分享配置失败');
  expect(fixture.sdk.config).not.toHaveBeenCalled();
});
