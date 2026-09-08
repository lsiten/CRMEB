import { act } from 'react-test-renderer';
import { expect, it } from 'vitest';
import { platform, serverOrder, response, deferred, render, textOf, press, button } from './order-page-fixture';
import List from '../src/pages/order/list';
import Detail from '../src/pages/order/detail';
import { setToken } from '../src/services/api';

it('shows login without requesting private orders for a guest', async () => {
  // Given a guest opening the order list.
  setToken(null);
  // When the page is mounted.
  await render(List);
  // Then a deliberate login entry replaces private requests and empty success.
  expect(platform.request).not.toHaveBeenCalled();
  expect(button('去登录')).toBeDefined();
  expect(textOf()).not.toContain('暂无订单');
});

it('keeps page one when page two fails and retries the same page', async () => {
  // Given a complete first page.
  platform.request.mockResolvedValueOnce(response(Array.from({ length: 20 }, (_, index) => ({ ...serverOrder, order_id: `wx${index}` }))));
  await render(List);
  platform.request.mockResolvedValueOnce({ statusCode: 500, data: {} });
  // When page two fails and is retried.
  await press('加载更多');
  expect(textOf()).toContain('wx19');
  platform.request.mockResolvedValueOnce(response([{ ...serverOrder, order_id: 'wx20' }]));
  await press('重试');
  // Then pagination does not skip the failed page.
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ page: 2 }) }));
  expect(textOf()).toContain('wx20');
});

it.each(['http', 'business'] as const)('shows recoverable %s 401 and clears private details', async (kind) => {
  // Given a loaded detail and an expired session.
  await render(Detail);
  platform.request.mockResolvedValueOnce(kind === 'http' ? { statusCode: 401, data: {} } : { statusCode: 200, data: { status: 401, msg: '登录已过期' } });
  // When the user refreshes.
  await press('刷新状态');
  // Then sensitive stale data disappears and login is available.
  expect(textOf()).not.toContain('订单号：');
  expect(button('去登录')).toBeDefined();
  setToken('account-b'); platform.request.mockResolvedValueOnce(response(serverOrder));
  await act(async () => { platform.show(); });
  expect(textOf()).toContain('wx1');
});

it('does not submit a confirmation opened by a previous login session', async () => {
  // Given a pending cancellation confirmation.
  await render(Detail);
  const modal = deferred<{ confirm: boolean }>(); platform.showModal.mockReturnValueOnce(modal.promise);
  await press('取消订单');
  // When the same token is explicitly signed in again before confirmation.
  await act(async () => { setToken('account-a'); modal.resolve({ confirm: true }); });
  // Then no request can mutate the old session order.
  expect(platform.request).toHaveBeenCalledTimes(1);
});

it('disables mutation after uncertain failure until status is refreshed', async () => {
  // Given a cancellation that fails at the HTTP boundary.
  await render(Detail); platform.request.mockResolvedValueOnce({ statusCode: 500, data: {} });
  // When cancellation returns an uncertain outcome.
  await press('取消订单');
  // Then explicit status reconciliation precedes another mutation.
  expect(button('取消订单').props['disabled']).toBe(true);
  platform.request.mockResolvedValueOnce(response({ ...serverOrder, is_cancel: 1, _status: { _type: 4, _title: '已取消' } }));
  await press('刷新状态');
  expect(textOf()).toContain('已取消');
  expect(textOf()).not.toContain('去支付');
});

it('reports successful cancellation even if the follow-up detail query fails', async () => {
  // Given a cancellation accepted by the server, followed by a failed read.
  await render(Detail);
  platform.request.mockResolvedValueOnce(response({})).mockResolvedValueOnce({ statusCode: 500, data: {} });
  // When cancellation is confirmed.
  await press('取消订单');
  // Then the mutation is not described as failed or repeated automatically.
  expect(textOf()).toContain('取消成功');
  expect(button('重新加载')).toBeDefined();
  expect(platform.request.mock.calls.filter(([input]) => input.url.endsWith('/order/cancel'))).toHaveLength(1);
});

it('loads a missing order parameter as an explicit recoverable page state', async () => {
  // Given a malformed entry URL.
  platform.params = { orderId: '' };
  // When the detail page opens.
  await render(Detail);
  // Then it does not query an empty order id or show an empty successful detail.
  expect(platform.request).not.toHaveBeenCalled();
  expect(textOf()).toContain('订单号缺失');
  expect(button('返回订单列表')).toBeDefined();
});
