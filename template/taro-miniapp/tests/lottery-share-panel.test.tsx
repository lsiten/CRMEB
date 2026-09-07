import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  requireLogin: vi.fn(() => true), getStorageSync: vi.fn(() => 'session'), hideShareMenu: vi.fn(async () => undefined), showShareMenu: vi.fn(async () => undefined), useDidShow: vi.fn(), useShareAppMessage: vi.fn(),
  state: { isShareCurrent: () => true, share: { title: '邀请抽奖', path: '/pages/marketing/lottery?type=5&lottery_id=72&spread=42', imageUrl: '/cover.png' }, busy: false, error: '', copied: false, prepare: vi.fn(), copy: vi.fn() }
}));
vi.mock('@tarojs/taro', () => ({ default: fixture }));
vi.mock('@tarojs/components', () => ({ Button: 'button', View: 'div', Text: 'span' }));
vi.mock('../src/services/auth-flow', () => ({ requireLogin: fixture.requireLogin }));
vi.mock('../src/state/lottery-share', () => ({ useLotteryShare: () => fixture.state }));
import { LotterySharePanel } from '../src/components/lottery-share';
let page: TestRenderer.ReactTestRenderer | undefined;
afterEach(() => { act(() => page?.unmount()); vi.clearAllMocks(); vi.unstubAllEnvs(); });
it('provides server-derived attribution to the native share callback', () => {
  // Given
  vi.stubEnv('TARO_ENV', 'weapp');
  act(() => { page = TestRenderer.create(<LotterySharePanel activity={{ id: '72', factor: 5, name: '邀请抽奖', image: '/cover.png' }} disabled={false} />); });
  // When
  act(() => page?.root.findAllByType('button')[0]?.props['onClick']());
  const callback = fixture.useShareAppMessage.mock.lastCall?.[0];
  // Then
  expect(callback()).toEqual(fixture.state.share);
  expect(page?.root.findAllByType('button').some(button => button.props['openType'] === 'share')).toBe(true);
  expect(fixture.requireLogin).toHaveBeenCalledWith('/pages/marketing/lottery?type=5&lottery_id=72');
  expect(fixture.state.prepare).toHaveBeenCalledTimes(2);
});
it('sends a guest to login without preparing a share', () => {
  // Given
  fixture.requireLogin.mockReturnValueOnce(false);
  act(() => { page = TestRenderer.create(<LotterySharePanel activity={{ id: '72', factor: 5, name: '邀请抽奖', image: '' }} disabled={false} />); });
  // When
  act(() => page?.root.findAllByType('button')[0]?.props['onClick']());
  // Then
  expect(fixture.state.prepare).not.toHaveBeenCalled();
  expect(page?.root.findAllByProps({ role: 'dialog' })).toHaveLength(0);
});
