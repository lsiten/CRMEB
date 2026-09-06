import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const hooks = vi.hoisted(() => ({
  show: vi.fn(), hide: vi.fn(),
  showTabBar: vi.fn().mockResolvedValue({}), hideTabBar: vi.fn().mockResolvedValue({}),
}));
vi.mock('@tarojs/taro', () => ({
  default: { showTabBar: hooks.showTabBar, hideTabBar: hooks.hideTabBar },
  useDidShow: hooks.show, useDidHide: hooks.hide,
}));
vi.mock('@tarojs/components', () => ({ View: 'div', Text: 'span', Button: 'button' }));
vi.mock('../src/components', () => ({ Empty: () => null, Loading: () => null }));
vi.mock('../src/diy/registry', () => ({ DiyRenderer: () => null }));
vi.mock('../src/services/diy', () => ({ getDiyPage: vi.fn().mockResolvedValue({
  title: '首页', background: {}, items: [{ name: 'pageFoot', effectConfig: { tabVal: 1 } }],
}) }));
import IndexPage from '../src/pages/index';

describe('homepage tab bar lifecycle', () => {
  it('restores native tabs on leaving and hides them on returning to a cached custom-footer homepage', async () => {
    let page: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => { page = TestRenderer.create(<IndexPage />); });
    expect(hooks.hideTabBar).toHaveBeenCalled();
    expect(hooks.hide).toHaveBeenCalled();
    hooks.showTabBar.mockClear();
    hooks.hide.mock.calls.at(-1)?.[0]();
    expect(hooks.showTabBar).toHaveBeenCalledOnce();
    hooks.hideTabBar.mockClear();
    hooks.show.mock.calls.at(-1)?.[0]();
    expect(hooks.hideTabBar).toHaveBeenCalledOnce();
    act(() => page?.unmount());
  });
});
