import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const platform = vi.hoisted(() => ({ show: vi.fn(), getStorageSync: vi.fn(), removeStorageSync: vi.fn(), navigateTo: vi.fn() }));
const catalog = vi.hoisted(() => ({ getCategories: vi.fn(), getCategoryProducts: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform, useDidShow: platform.show }));
vi.mock('@tarojs/components', () => ({ View: 'div', Text: 'span', Button: 'button', Input: 'input' }));
vi.mock('../src/components', () => ({ Empty: ({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) => <div>{title}<button onClick={onAction}>{actionLabel}</button></div> }));
vi.mock('../src/components/commerce-image', () => ({ CommerceImage: () => null }));
vi.mock('../src/services/catalog', () => catalog);
import GoodsPage from '../src/pages/goods';

const products = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, name: `商品${index + 1}`, price: 10, image: '' }));
let renderer: TestRenderer.ReactTestRenderer;
const button = (label: string) => renderer.root.findAllByType('button').find((node) => node.children.join('') === label);
async function click(label: string) {
  const target = button(label);
  expect(target, label).toBeDefined();
  await act(async () => { target?.props.onClick(); });
}
beforeEach(async () => {
  vi.clearAllMocks();
  platform.getStorageSync.mockReturnValue('');
  catalog.getCategories.mockResolvedValue([{ id: 3, name: '家居', children: [] }]);
  catalog.getCategoryProducts.mockResolvedValue(products);
  await act(async () => { renderer = TestRenderer.create(<GoodsPage />); });
});
afterEach(() => act(() => renderer.unmount()));

describe('catalog discovery', () => {
  it('keeps the loaded page when loading more fails and retries the same page', async () => {
    catalog.getCategoryProducts.mockRejectedValueOnce(new Error('offline'));
    await click('加载更多');
    expect(renderer.root.findAllByProps({ className: 'catalog-product' })).toHaveLength(20);
    catalog.getCategoryProducts.mockResolvedValueOnce([{ ...products[0], id: 21, name: '新商品' }]);
    await click('重试加载更多');
    expect(catalog.getCategoryProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    expect(renderer.root.findAllByProps({ className: 'catalog-product' })).toHaveLength(21);
  });
  it('resets pagination and sends server sorting when selecting price and sales', async () => {
    await click('加载更多');
    await click('价格');
    expect(catalog.getCategoryProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: 'price-asc' }));
    await click('价格从低到高');
    expect(catalog.getCategoryProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: 'price-desc' }));
    await click('销量');
    expect(catalog.getCategoryProducts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, sort: 'sales' }));
  });
  it('searches all categories for an incoming search keyword', async () => {
    await click('家居');
    platform.getStorageSync.mockImplementation((key: string) => key === 'crmeb_search_keyword' ? ' 茶杯 ' : '');
    await act(async () => { platform.show.mock.calls.at(-1)?.[0](); });
    expect(catalog.getCategoryProducts).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: 0, keyword: '茶杯', page: 1 }));
  });
  it('retries an unchanged keyword after a first-page error', async () => {
    catalog.getCategoryProducts.mockRejectedValueOnce(new Error('offline'));
    await act(async () => renderer.root.findByType('input').props.onInput({ detail: { value: '茶杯' } }));
    await click('搜索');
    const calls = catalog.getCategoryProducts.mock.calls.length;
    await click('搜索');
    expect(catalog.getCategoryProducts).toHaveBeenCalledTimes(calls + 1);
  });
  it('ignores a stale page result after the category changes', async () => {
    let finish: (value: typeof products) => void = () => undefined;
    catalog.getCategoryProducts.mockReturnValueOnce(new Promise<typeof products>((resolve) => { finish = resolve; }));
    await click('加载更多');
    catalog.getCategoryProducts.mockResolvedValueOnce([{ id: 90, name: '新分类商品', price: 20, image: '' }]);
    await click('家居');
    await act(async () => { finish([{ id: 99, name: '旧分类商品', price: 20, image: '' }]); });
    expect(renderer.root.findAllByProps({ className: 'catalog-name' }).map((node) => node.children.join(''))).toEqual(['新分类商品']);
  });
  it('clears the keyword and returns to the first page', async () => {
    await act(async () => renderer.root.findByType('input').props.onInput({ detail: { value: '茶杯' } }));
    await click('搜索');
    await click('加载更多');
    await click('清除搜索');
    expect(catalog.getCategoryProducts).toHaveBeenLastCalledWith(expect.objectContaining({ keyword: '', page: 1 }));
  });
  it('retries category loading without appending the product page twice', async () => {
    act(() => renderer.unmount());
    catalog.getCategories.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { renderer = TestRenderer.create(<GoodsPage />); });
    const calls = catalog.getCategoryProducts.mock.calls.length;
    await click('分类加载失败，点击重试');
    expect(catalog.getCategoryProducts).toHaveBeenCalledTimes(calls);
  });
});
