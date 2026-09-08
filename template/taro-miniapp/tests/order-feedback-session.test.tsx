import { act } from 'react-test-renderer';
import { expect, it } from 'vitest';
import { platform, serverOrder, response, render, textOf, press } from './order-page-fixture';
import Detail from '../src/pages/order/detail';
import { setToken } from '../src/services/api';

it.each(['same-session', 'logout', 'hide-logout', 'switch', 'same-token-login'])('isolates completed action errors after %s', async (change) => {
  await render(Detail);
  platform.request.mockResolvedValueOnce({ statusCode: 200, data: { status: 400, msg: '订单 wx1 当前无法取消' } });
  await press('取消订单');
  expect(textOf()).toContain('订单 wx1 当前无法取消');
  await act(async () => {
    if (change === 'hide-logout') platform.hide();
    if (change === 'logout' || change === 'hide-logout') setToken(null);
    if (change === 'switch') setToken('account-b');
    if (change === 'same-token-login') setToken('account-a');
  });
  if (change === 'same-session') expect(textOf()).toContain('订单 wx1 当前无法取消');
  else expect(textOf()).not.toContain('订单 wx1 当前无法取消');
});

it.each(['same-session', 'switch', 'same-token-login', 'logout-login'])('keeps success feedback owned by its session after %s and refresh', async (change) => {
  await render(Detail);
  platform.request.mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ ...serverOrder, is_cancel: 1, _status: { _type: 4 } }));
  await press('取消订单');
  expect(textOf()).toContain('取消成功');
  await act(async () => {
    if (change === 'switch') setToken('account-b');
    if (change === 'same-token-login') setToken('account-a');
    if (change === 'logout-login') setToken(null);
  });
  if (change !== 'same-session') expect(textOf()).not.toContain('取消成功');
  if (change === 'logout-login') await act(async () => { setToken('account-a'); });
  platform.request.mockResolvedValueOnce(change !== 'same-session'
    ? { statusCode: 200, data: { status: 400, msg: '订单不存在' } }
    : response({ ...serverOrder, is_cancel: 1, _status: { _type: 4 } }));
  await press('刷新状态');
  if (change !== 'same-session') expect(textOf()).toContain('订单不存在');
  if (change === 'same-session') expect(textOf()).toContain('取消成功');
  else expect(textOf()).not.toContain('取消成功');
});
