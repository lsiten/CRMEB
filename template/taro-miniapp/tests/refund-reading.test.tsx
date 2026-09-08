import { act } from 'react-test-renderer';
import { expect, it } from 'vitest';
import { platform, response, render, rendered, textOf, press, deferred } from './refund-page-fixture';
import List from '../src/pages/order/refunds';
import Detail from '../src/pages/order/refund-detail';
import { setToken } from '../src/services/api';

const refund = { id: 9, order_id: 'refund9', refund_type: 4, refund_price: '25.50', store_order_sn: 'order81', cart_info: [], _status: { refund_address: '账号A退货地址' } };
function prepare(detail: boolean) {
  Object.assign(platform.params, { id: 'refund9' });
  platform.request.mockResolvedValue(response(detail ? refund : { list: [refund] }));
  return detail ? Detail : List;
}

it.each([false, true])('offers login without requesting private data when anonymous (detail=%s)', async (detail) => {
  const Page = prepare(detail);
  setToken(null);
  await render(Page);
  expect(platform.request).not.toHaveBeenCalled();
  expect(textOf()).toContain('去登录');
});

it.each([false, true])('hides settled data immediately when the account changes (detail=%s)', async (detail) => {
  await render(prepare(detail));
  expect(textOf()).toContain('refund9');
  await act(async () => { setToken('account-b'); });
  expect(textOf()).not.toContain('refund9');
  expect(textOf()).not.toContain('账号A退货地址');
});

it.each([false, true])('hides previous server errors when the account changes (detail=%s)', async (detail) => {
  const Page = prepare(detail);
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 400, msg: '账号A的售后错误' } });
  await render(Page);
  expect(textOf()).toContain('账号A的售后错误');
  await act(async () => { setToken('account-b'); });
  expect(textOf()).not.toContain('账号A的售后错误');
});

it.each(['switch', 'same-token', 'logout', 'hide', 'unmount'])('discards pending detail data after %s', async (change) => {
  prepare(true);
  const pending = deferred<ReturnType<typeof response>>();
  platform.request.mockReturnValue(pending.promise);
  await render(Detail);
  await act(async () => {
    if (change === 'switch') setToken('account-b');
    if (change === 'same-token') setToken('account-a');
    if (change === 'logout') setToken(null);
    if (change === 'hide') platform.hide();
    if (change === 'unmount') rendered?.unmount();
    pending.resolve(response(refund));
  });
  expect(textOf()).not.toContain('账号A退货地址');
});

it('retries a failed list page without losing the previous page', async () => {
  prepare(false);
  platform.request.mockResolvedValueOnce(response({ list: Array.from({ length: 20 }, (_, i) => ({ ...refund, order_id: `refund${i}` })) }));
  await render(List);
  platform.request.mockResolvedValueOnce({ statusCode: 500, data: {} });
  await press('加载更多');
  expect(textOf()).toContain('refund19');
  expect(textOf()).not.toContain('暂无售后记录');
  platform.request.mockResolvedValueOnce(response({ list: [] }));
  await press('重试');
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: { page: 2, limit: 20 } }));
  expect(textOf()).toContain('refund19');
});

it('recovers a detail read and refreshes the server state', async () => {
  prepare(true);
  platform.request.mockResolvedValueOnce({ statusCode: 500, data: {} });
  await render(Detail);
  await press('重新加载');
  expect(textOf()).toContain('请寄回商品');
  platform.request.mockResolvedValueOnce(response({ ...refund, refund_type: 6 }));
  await press('刷新状态');
  expect(textOf()).toContain('已退款');
});

it('offers a way back when the detail identifier is missing', async () => {
  await render(Detail);
  expect(platform.request).not.toHaveBeenCalled();
  expect(textOf()).toContain('返回售后列表');
});

it('shows a product empty state without exposing write controls', async () => {
  await render(prepare(true));
  expect(textOf()).toContain('暂无商品明细');
  expect(textOf()).not.toContain('撤销申请');
  expect(textOf()).not.toContain('提交退货信息');
});

it.each([false, true])('recovers after a 401 and a fresh login (detail=%s)', async (detail) => {
  const Page = prepare(detail);
  platform.request.mockResolvedValueOnce({ statusCode: 401, data: {} });
  await render(Page);
  expect(textOf()).toContain('去登录');
  await act(async () => { setToken('account-b'); });
  await press('刷新状态');
  expect(textOf()).toContain('refund9');
});
it('renders an empty list only after successful loading', async () => {
  prepare(false);
  platform.request.mockResolvedValue(response({ list: [] }));
  await render(List);
  expect(textOf()).toContain('暂无售后记录');
});
it.each([false, true])('recovers independently of an older in-flight request (detail=%s)', async (detail) => {
  const Page = prepare(detail);
  const pending = deferred<ReturnType<typeof response>>();
  platform.request.mockReturnValueOnce(pending.promise);
  await render(Page);
  await act(async () => { setToken('account-b'); });
  platform.request.mockResolvedValueOnce(response(detail ? { ...refund, refund_type: 6 } : { list: [{ ...refund, refund_type: 6 }] }));
  await press('刷新状态');
  await act(async () => { pending.resolve(response(detail ? refund : { list: [refund] })); });
  expect(textOf()).toContain('已退款');
  expect(textOf()).not.toContain('请寄回商品');
});

it.each(['switch-reload', 'hide', 'unmount'])('rejects a saved list navigation callback after %s', async (change) => {
  await render(prepare(false));
  const entry = rendered?.root.findAllByType('button').find((node) => node.children.join('') === '查看进度');
  const navigate = entry?.props['onClick'];
  await act(async () => {
    if (change === 'switch-reload') setToken('account-b');
    if (change === 'hide') platform.hide();
    if (change === 'unmount') rendered?.unmount();
  });
  if (change === 'switch-reload') await press('刷新状态');
  await act(async () => { navigate(); });
  expect(platform.navigateTo).not.toHaveBeenCalled();
});

it.each(['switch-reload', 'hide', 'unmount'])('rejects a saved preview callback after %s', async (change) => {
  prepare(true);
  platform.request.mockResolvedValue(response({ ...refund, refund_img: ['https://example.test/account-a.png'] }));
  await render(Detail);
  const preview = rendered?.root.findByType('image').props['onClick'];
  await act(async () => {
    if (change === 'switch-reload') setToken('account-b');
    if (change === 'hide') platform.hide();
    if (change === 'unmount') rendered?.unmount();
  });
  if (change === 'switch-reload') await press('刷新状态');
  await act(async () => { preview(); });
  expect(platform.previewImage).not.toHaveBeenCalled();
});
it('allows a fresh list callback after hiding and showing the page', async () => {
  await render(prepare(false));
  await act(async () => { platform.hide(); });
  await act(async () => { platform.show(); });
  await press('查看进度');
  expect(platform.navigateTo).toHaveBeenCalledWith({ url: '/pages/order/refund-detail?id=refund9' });
});
it('allows a fresh preview callback after hiding and showing the page', async () => {
  prepare(true);
  platform.request.mockResolvedValue(response({ ...refund, refund_img: ['https://example.test/proof.png'] }));
  await render(Detail);
  await act(async () => { platform.hide(); });
  await act(async () => { platform.show(); });
  await act(async () => { rendered?.root.findByType('image').props['onClick'](); });
  expect(platform.previewImage).toHaveBeenCalledWith({ current: 'https://example.test/proof.png', urls: ['https://example.test/proof.png'] });
});

it('invalidates the old preview when the detail route identifier changes', async () => {
  prepare(true);
  platform.request.mockResolvedValue(response({ ...refund, refund_img: ['https://example.test/old.png'] }));
  await render(Detail);
  const oldPreview = rendered?.root.findByType('image').props['onClick'];
  Object.assign(platform.params, { id: 'refund10' });
  platform.request.mockResolvedValue(response({ ...refund, order_id: 'refund10', refund_img: ['https://example.test/new.png'] }));
  await act(async () => { rendered?.update(<Detail />); });
  await act(async () => { oldPreview(); });
  expect(platform.previewImage).not.toHaveBeenCalled();
  await act(async () => { rendered?.root.findByType('image').props['onClick'](); });
  expect(platform.previewImage).toHaveBeenCalledWith({ current: 'https://example.test/new.png', urls: ['https://example.test/new.png'] });
});
it.each([false, true])('discards a previous account late business error (detail=%s)', async (detail) => {
  const Page = prepare(detail);
  const pending = deferred<{ statusCode: number; data: { status: number; msg: string } }>();
  platform.request.mockReturnValueOnce(pending.promise);
  await render(Page);
  await act(async () => { setToken('account-b'); });
  await press('刷新状态');
  await act(async () => { pending.resolve({ statusCode: 200, data: { status: 400, msg: '旧账号的私有错误' } }); });
  expect(textOf()).not.toContain('旧账号的私有错误');
  expect(textOf()).toContain('refund9');
});
