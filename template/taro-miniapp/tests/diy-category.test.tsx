import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
const hooks = vi.hoisted(() => ({ show: vi.fn(), getStorageSync: vi.fn((key: string) => key === 'crmeb_diy_category' ? 16 : ''), removeStorageSync: vi.fn(), showToast: vi.fn() }));
const catalog = vi.hoisted(() => ({ getCategories: vi.fn().mockResolvedValue([{ id: 3, name: '家居', children: [{ id: 16, name: '桌椅', children: [] }] }]), getCategoryProducts: vi.fn().mockResolvedValue([]) }));
vi.mock('@tarojs/taro', () => ({ default: hooks, useDidShow: hooks.show }));
vi.mock('@tarojs/components', () => ({ View: 'div', Text: 'span', Button: 'button', Input: 'input' }));
vi.mock('../src/components', () => ({ Empty: () => null }));
vi.mock('../src/components/commerce-image', () => ({ CommerceImage: () => null }));
vi.mock('../src/services/catalog', () => catalog);
import GoodsPage from '../src/pages/goods';

describe('DIY category handoff', () => {
  it('selects the parent and filters the configured child after categories load', async () => {
    let page: TestRenderer.ReactTestRenderer | undefined;
    await act(async () => { page = TestRenderer.create(<GoodsPage />); });
    await act(async () => { hooks.show.mock.calls.at(-1)?.[0](); });
    expect(catalog.getCategoryProducts).toHaveBeenLastCalledWith({ categoryId: 16, keyword: '', page: 1 });
    expect(page?.root.findAllByProps({ className: 'active' }).map((entry) => entry.children.join(''))).toContain('家居');
    expect(hooks.removeStorageSync).toHaveBeenCalledWith('crmeb_diy_category');
    act(() => page?.unmount());
  });
});
