import { act } from 'react-test-renderer';
import { expect, it } from 'vitest';
import { platform, serverOrder, response, deferred, render, textOf, press, button } from './order-page-fixture';
import Detail from '../src/pages/order/detail';

it('releases the action lock when confirmation is cancelled', async () => {
  // Given a displayed cancellable order.
  await render(Detail); platform.showModal.mockResolvedValueOnce({ confirm: false });
  // When the user dismisses the confirmation.
  await press('取消订单');
  // Then no mutation was sent and the control can be used again.
  expect(platform.request).toHaveBeenCalledTimes(1);
  expect(button('取消订单').props['disabled']).toBe(false);
});

it('submits only once when an action is double clicked', async () => {
  // Given a cancellation request that remains in flight.
  await render(Detail);
  const pending = deferred<ReturnType<typeof response>>(); platform.request.mockReturnValueOnce(pending.promise);
  const click = button('取消订单').props['onClick'];
  // When multiple clicks reach the same callback before it completes.
  await act(async () => { click(); click(); });
  await act(async () => { click(); });
  // Then a single confirmation and mutation own the lock.
  expect(platform.showModal).toHaveBeenCalledTimes(1);
  expect(platform.request.mock.calls.filter(([input]) => input.method === 'POST')).toHaveLength(1);
  await act(async () => { pending.resolve(response({})); });
});

it.each(['http', 'business'] as const)('shows login for a current cancellation %s 401', async (kind) => {
  // Given a displayed order whose session expires on mutation.
  await render(Detail);
  platform.request.mockResolvedValueOnce(kind === 'http' ? { statusCode: 401, data: {} } : { statusCode: 200, data: { status: 401, msg: '登录已过期' } });
  // When cancellation is confirmed.
  await press('取消订单');
  // Then current expiry remains recoverable and private order data is hidden.
  expect(platform.token).toBe('');
  expect(button('去登录')).toBeDefined();
  expect(textOf()).not.toContain('订单号：');
});

it('shows the server-confirmed receipt transition with no lingering loading feedback', async () => {
  // Given a shipped order and a server accepted receipt.
  platform.request.mockResolvedValueOnce(response({ ...serverOrder, paid: 1, _status: { _type: 2 } }));
  await render(Detail);
  platform.request.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ ...serverOrder, paid: 1, _status: { _type: 3, _title: '待评价' } }));
  // When receipt is confirmed.
  await press('确认收货');
  // Then completed feedback and the latest server state are displayed together.
  expect(textOf()).toContain('收货成功');
  expect(textOf()).toContain('待评价');
  expect(textOf()).not.toContain('正在核对');
});
