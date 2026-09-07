import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ getStorageSync: vi.fn(() => 'session'), showShareMenu: vi.fn(async () => undefined), hideShareMenu: vi.fn(async () => undefined), useShareAppMessage: vi.fn(), useDidShow: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
import { useNativeLotteryShare } from '../src/state/native-lottery-share';
const fallback = { title: '抽奖', path: '/pages/marketing/lottery?type=5&lottery_id=72' };
const share = { ...fallback, path: `${fallback.path}&spread=42`, imageUrl: '/cover.png' };
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe({ ready, current = true, prepare }: Readonly<{ ready: boolean; current?: boolean; prepare: () => Promise<void> }>) {
  useNativeLotteryShare({ share: ready ? share : undefined, prepare, isShareCurrent: () => ready && current }, fallback);
  return null;
}
afterEach(() => { act(() => page?.unmount()); vi.clearAllMocks(); platform.getStorageSync.mockReturnValue('session'); vi.unstubAllEnvs(); });
it('prepares at entry, hides until ready, then enables only the friend share menu', async () => {
  // Given
  vi.stubEnv('TARO_ENV', 'weapp'); const prepare = vi.fn(async () => undefined);
  await act(async () => { page = TestRenderer.create(<Probe ready={false} prepare={prepare} />); });
  expect(prepare).toHaveBeenCalledOnce();
  expect(platform.hideShareMenu).toHaveBeenCalled();
  // When
  await act(async () => { page?.update(<Probe ready prepare={prepare} />); });
  // Then
  expect(platform.showShareMenu).toHaveBeenCalledWith({ showShareItems: ['shareAppMessage'] });
  expect(platform.useShareAppMessage.mock.lastCall?.[0]()).toEqual(share);
});
it('refreshes on page return and does not publish a previous account attribution', async () => {
  // Given
  vi.stubEnv('TARO_ENV', 'weapp'); const prepare = vi.fn(async () => undefined);
  await act(async () => { page = TestRenderer.create(<Probe ready prepare={prepare} />); });
  // When
  await act(async () => { page?.update(<Probe ready current={false} prepare={prepare} />); platform.useDidShow.mock.lastCall?.[0](); });
  // Then
  expect(prepare).toHaveBeenCalledTimes(2);
  expect(platform.useShareAppMessage.mock.lastCall?.[0]()).toEqual(fallback);
});
it('keeps H5 free of native menu and lifecycle calls', async () => {
  // Given
  vi.stubEnv('TARO_ENV', 'h5'); const prepare = vi.fn(async () => undefined);
  // When
  await act(async () => { page = TestRenderer.create(<Probe ready prepare={prepare} />); });
  // Then
  expect(prepare).not.toHaveBeenCalled();
  expect(platform.showShareMenu).not.toHaveBeenCalled();
  expect(platform.useShareAppMessage).not.toHaveBeenCalled();
});

it('hides the menu on a logged-out return without preparing another invitation', async () => {
  vi.stubEnv('TARO_ENV', 'weapp');
  const prepare = vi.fn(async () => undefined);
  await act(async () => { page = TestRenderer.create(<Probe ready prepare={prepare} />); });
  platform.getStorageSync.mockReturnValue('');
  await act(async () => { page?.update(<Probe ready current={false} prepare={prepare} />); });
  await act(async () => { platform.useDidShow.mock.lastCall?.[0](); });
  expect(prepare).toHaveBeenCalledOnce();
  expect(platform.hideShareMenu).toHaveBeenCalled();
  expect(platform.useShareAppMessage.mock.lastCall?.[0]()).toEqual(fallback);
});
