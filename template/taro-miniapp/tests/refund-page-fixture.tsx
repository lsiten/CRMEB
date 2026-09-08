import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, vi } from 'vitest';
const lifecycle = vi.hoisted(() => ({ hide: new Set<() => void>(), show: new Set<() => void>() }));
const platform = vi.hoisted(() => ({ request: vi.fn(), token: 'account-a', params: { orderId: 'wx1' },
  previewImage: vi.fn(), navigateTo: vi.fn(), redirectTo: vi.fn(), showModal: vi.fn(), switchTab: vi.fn(), hide: () => {}, show: () => {} }));
export { platform };
vi.mock('@tarojs/taro', () => ({ default: { ...platform,
  getStorageSync: () => platform.token, setStorageSync: (_key: string, value: string) => { platform.token = value; },
  removeStorageSync: () => { platform.token = ''; } },
  useRouter: () => ({ params: platform.params }),
  useDidShow: (callback: () => void) => {
    useEffect(callback, []);
    useEffect(() => { lifecycle.show.add(callback); return () => { lifecycle.show.delete(callback); }; }, [callback]);
  },
  useDidHide: (callback: () => void) => { useEffect(() => { lifecycle.hide.add(callback); return () => { lifecycle.hide.delete(callback); }; }, [callback]); },
}));
vi.mock('@tarojs/components', () => ({ View: 'view', Text: 'text', Button: 'button', Input: 'input', Picker: 'picker' }));
vi.mock('../src/components/commerce-image', () => ({ CommerceImage: (props: Readonly<{ onClick?: () => void }>) => React.createElement('image', props) }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { setToken } from '../src/services/api';
export const serverOrder = { order_id: 'wx1', paid: 0, pay_price: '10.00', _status: { _type: 0, _title: '待付款' }, cartInfo: [] };
export function response(data: unknown) { return { statusCode: 200, data: { status: 200, data } }; }
export function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
export let rendered: TestRenderer.ReactTestRenderer | undefined;
export async function render(Page: React.ComponentType) { await act(async () => { rendered = TestRenderer.create(<Page />); }); }
export function textOf(): string { return JSON.stringify(rendered?.toJSON()); }
export function button(label: string) {
  const found = rendered?.root.findAllByType('button').find((node) => node.children.join('') === label);
  if (!found) throw new Error(`Button missing: ${label}`);
  return found;
}
export async function press(label: string) { await act(async () => { button(label).props['onClick'](); }); }
beforeEach(() => {
  vi.clearAllMocks(); setToken('account-a'); platform.params = { orderId: 'wx1' };
  platform.hide = () => { for (const callback of lifecycle.hide) callback(); };
  platform.show = () => { for (const callback of lifecycle.show) callback(); };
  platform.showModal.mockResolvedValue({ confirm: true });
  platform.request.mockResolvedValue(response(serverOrder));
});
afterEach(async () => { await act(async () => { rendered?.unmount(); }); rendered = undefined; });
