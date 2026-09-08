import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getCoupons: vi.fn() }));
vi.mock('../src/services/assets', () => api);
vi.mock('@tarojs/components', () => ({ Button: 'button', Text: 'span', View: 'div' }));
vi.mock('@tarojs/taro', () => ({ default: { switchTab: vi.fn() }, useDidShow: (callback: () => void) => React.useEffect(callback, []) }));
import CouponPage from '../src/pages/coupon';

beforeEach(() => vi.clearAllMocks());

it('shows loading instead of an empty result while the request is pending', async () => {
  // Given a pending request, when the page mounts, then no empty state appears.
  api.getCoupons.mockReturnValue(new Promise(() => undefined));
  const page = TestRenderer.create(<CouponPage />);
  await act(async () => undefined);
  expect(JSON.stringify(page.toJSON())).toContain('正在加载优惠券');
  expect(JSON.stringify(page.toJSON())).not.toContain('暂无');
  page.unmount();
});

it('preserves the selected tab through failure and retries to a successful empty result', async () => {
  // Given a failed request, when selecting a tab and retrying, then only success is empty.
  api.getCoupons.mockRejectedValueOnce(new Error('优惠券加载失败')).mockResolvedValueOnce([]);
  const page = TestRenderer.create(<CouponPage />);
  await act(async () => undefined);
  expect(JSON.stringify(page.toJSON())).toContain('操作失败，请稍后重试');
  expect(JSON.stringify(page.toJSON())).not.toContain('暂无');
  act(() => page.root.findAllByType('button').find((button) => button.children.includes('已过期'))?.props.onClick());
  await act(async () => { await page.root.findByProps({ children: '重试' }).props.onClick(); });
  expect(api.getCoupons).toHaveBeenCalledTimes(2);
  expect(JSON.stringify(page.toJSON())).toContain('已过期');
  expect(JSON.stringify(page.toJSON())).toContain('暂无');
  page.unmount();
});
