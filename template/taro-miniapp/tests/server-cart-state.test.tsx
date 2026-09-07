import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ get: vi.fn(), change: vi.fn(), remove: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: { getStorageSync: () => 'session' }, useDidShow: (callback: () => void) => useEffect(callback, []) }));
vi.mock('../src/services/server-cart', () => ({ getServerCart: mocks.get, changeServerCartQuantity: mocks.change, deleteServerCart: mocks.remove }));
import { useServerCart } from '../src/state/server-cart';
import type { CartPage, ServerCartItem } from '../src/services/server-cart';
const item: ServerCartItem = { id: 1, name: '测试商品', image: '', price: 10, quantity: 2, stock: 10, cartId: 'cart1', valid: true };
let state: ReturnType<typeof useServerCart> | undefined;
let page: TestRenderer.ReactTestRenderer | undefined;
function Probe() { state = useServerCart(); return null; }
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockImplementation(async ({ valid }: { valid: boolean }) => ({ items: valid ? [item] : [], hasMore: false }));
});
afterEach(() => { act(() => page?.unmount()); state = undefined; });
it('does not allow a late refresh to overwrite a concurrent cart mutation', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  let finish: ((value: CartPage) => void) | undefined;
  mocks.get.mockImplementationOnce(() => new Promise<CartPage>((resolve) => { finish = resolve; }));
  await act(async () => { void state?.load(); });
  expect(state?.loading).toBe(true);
  await act(async () => { await state?.changeQuantity(item, 3); });
  expect(mocks.change).not.toHaveBeenCalled();
  await act(async () => { finish?.({ items: [item], hasMore: false }); });
  await act(async () => { await state?.changeQuantity(item, 3); });
  expect(state?.items[0]?.quantity).toBe(3);
});
it('preserves the rendered quantity when the server rejects a change', async () => {
  mocks.change.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.changeQuantity(item, 3); });
  expect(state?.items[0]?.quantity).toBe(2);
  expect(state?.error).not.toBe('');
});
it('removes both the row and its selection only after server deletion succeeds', async () => {
  await act(async () => { page = TestRenderer.create(<Probe />); });
  await act(async () => { await state?.changeQuantity(item, 0); });
  expect(mocks.remove).toHaveBeenCalledWith(['cart1']);
  expect(state?.items).toEqual([]);
  expect(state?.selected).toEqual([]);
});
