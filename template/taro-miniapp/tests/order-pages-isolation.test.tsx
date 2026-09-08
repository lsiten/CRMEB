import { act } from 'react-test-renderer';
import { expect, it } from 'vitest';
import { platform, serverOrder, response, deferred, render, textOf, press, button, rendered } from './order-page-fixture';
import List from '../src/pages/order/list';
import Detail from '../src/pages/order/detail';
import { setToken } from '../src/services/api';

const changes = ['switch', 'logout', 'same-token', 'hide', 'hide-show', 'unmount'] as const;
function change(kind: typeof changes[number]) {
  switch (kind) {
    case 'switch': setToken('account-b'); break;
    case 'logout': setToken(null); break;
    case 'same-token': setToken('account-a'); break;
    case 'hide': platform.hide(); break;
    case 'hide-show': platform.hide(); platform.show(); break;
    case 'unmount': rendered?.unmount(); break;
  }
}
for (const Page of [List, Detail]) {
  for (const kind of ['switch', 'logout', 'same-token'] as const) {
    it(`clears idle ${Page.name} content immediately after ${kind}`, async () => {
      // Given displayed private data with no request in flight.
      platform.request.mockResolvedValueOnce(response(Page === List ? [serverOrder] : serverOrder));
      await render(Page);
      expect(textOf()).toContain('wx1');
      // When authentication changes without any page interaction or lifecycle event.
      await act(async () => { change(kind); });
      // Then old private data is absent from the rendered page.
      expect(textOf()).not.toContain('wx1');
    });
  }
  for (const kind of changes) {
    it(`isolates pending ${Page.name} data after ${kind}`, async () => {
      // Given a request owned by the old page/session.
      const pending = deferred<ReturnType<typeof response>>();
      platform.request.mockReturnValueOnce(pending.promise);
      await render(Page);
      // When ownership changes before the old response arrives.
      platform.request.mockResolvedValue(response(Page === List ? [] : { ...serverOrder, order_id: 'new-order' }));
      await act(async () => { change(kind); });
      await act(async () => { pending.resolve(response(Page === List ? [serverOrder] : serverOrder)); });
      // Then old private data is never published.
      expect(textOf()).not.toContain('wx1');
    });
  }
}

for (const kind of changes) {
  for (const success of [true, false]) {
    it(`isolates deletion ${success ? 'success' : '401'} after ${kind}`, async () => {
      // Given a completed order and an in-flight deletion.
      platform.request.mockResolvedValueOnce(response({ ...serverOrder, paid: 1, _status: { _type: 4 } }));
      await render(Detail);
      const pending = deferred<ReturnType<typeof response>>(); platform.request.mockReturnValueOnce(pending.promise);
      await press('删除订单');
      // When ownership changes before the mutation response arrives.
      platform.request.mockResolvedValue(response({ ...serverOrder, order_id: 'new-order' }));
      await act(async () => { change(kind); });
      await act(async () => { pending.resolve(success ? response({}) : { statusCode: 401, data: { status: 401, data: {} } }); });
      // Then stale responses cannot navigate or expose stale action errors.
      expect(platform.redirectTo).not.toHaveBeenCalled();
      expect(textOf()).not.toContain('请先刷新状态');
    });
  }
}

it('does not submit an order displayed before an idle account change', async () => {
  // Given an already displayed account A order.
  await render(Detail);
  const click = button('取消订单').props['onClick'];
  // When account B signs in before the old button is clicked.
  await act(async () => { setToken('account-b'); click(); });
  // Then the click must reload before it can open a confirmation or mutate.
  expect(platform.showModal).not.toHaveBeenCalled();
  expect(platform.request.mock.calls.some(([input]) => input.method === 'POST')).toBe(false);
});

it('restarts pagination instead of mixing orders across an idle account change', async () => {
  // Given a full first page belonging to account A.
  platform.request.mockResolvedValueOnce(response(Array.from({ length: 20 }, (_, index) => ({ ...serverOrder, order_id: `old-${index}` }))));
  await render(List);
  const click = button('加载更多').props['onClick'];
  // When account B clicks the still-rendered pagination button.
  platform.request.mockResolvedValueOnce(response([{ ...serverOrder, order_id: 'new-order' }]));
  await act(async () => { setToken('account-b'); click(); });
  // Then a fresh page one replaces the old account's data.
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ page: 1 }) }));
  expect(textOf()).not.toContain('old-');
  expect(textOf()).toContain('new-order');
});
