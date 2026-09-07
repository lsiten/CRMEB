import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';
import type { DeepLinkInput } from '../src/services/platform';

const platform = vi.hoisted(() => ({ options: {}, setStorageSync: vi.fn(), getStorageSync: () => undefined }));
vi.mock('@tarojs/taro', () => ({ default: platform, useDidShow: (callback: (options: DeepLinkInput) => void) => useEffect(() => callback(platform.options), []) }));
vi.mock('../src/services/telemetry', () => ({ startPerformanceTracking: vi.fn() }));
vi.mock('@tarojs/components', () => ({ View: 'view', Text: 'text', Button: 'button' }));
import App from '../src/app';

it.each([
  { options: { scene: 1047, query: { scene: '321' } }, expected: { code: '321' } },
  { options: { scene: 1048, query: { scene: 'pid%3D42' } }, expected: { spread: '42' } },
  { options: { scene: 1001, query: { scene: '73' } }, expected: { spid: '73' } },
])('persists classified referral data through the actual App lifecycle for $options', ({ options, expected }) => {
  // Given
  platform.options = options;
  platform.setStorageSync.mockClear();
  let app: TestRenderer.ReactTestRenderer | undefined;
  // When
  act(() => { app = TestRenderer.create(<App><span>Fixture child</span></App>); });
  // Then
  expect(platform.setStorageSync).toHaveBeenCalledExactlyOnceWith('crmeb_referral', expected);
  act(() => app?.unmount());
});
