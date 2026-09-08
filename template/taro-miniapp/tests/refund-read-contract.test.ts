import { expect, it } from 'vitest';
import { platform, response } from './refund-page-fixture';
import { getRefund } from '../src/services/refunds';

const refund = { id: 9, order_id: 'refund9', refund_type: 4, refund_price: '25.50', cart_info: [{ id: 'cart81', cart_num: 2, surplus_num: 0, refund_num: 2, productInfo: { store_name: '咖啡' } }] };
it('uses the refund snapshot quantity instead of the remaining refundable quantity', async () => {
  platform.request.mockResolvedValue(response(refund));
  expect((await getRefund('refund9')).products[0]).toMatchObject({ quantity: 2 });
});
it('distinguishes a cancelled application from an active refund', async () => {
  platform.request.mockResolvedValue(response({ ...refund, is_cancel: 1 }));
  expect(await getRefund('refund9')).toMatchObject({ title: '已撤销售后', cancelled: true });
});
it('rejects a mismatched detail identifier', async () => {
  platform.request.mockResolvedValue(response(refund));
  await expect(getRefund('refund-other')).rejects.toThrow();
});
it.each([0, -1, 1.5, 'bad', undefined])('rejects an invalid snapshot quantity %s', async (cart_num) => {
  platform.request.mockResolvedValue(response({ ...refund, cart_info: [{ ...refund.cart_info[0], cart_num }] }));
  await expect(getRefund('refund9')).rejects.toThrow();
});

it.each([[1, '退款审核中'], [2, '退货审核中'], [3, '退款被拒绝'], [4, '请寄回商品'], [5, '等待商家收货退款'], [6, '已退款']])('reads status %s without collapsing its stage', async (refund_type, title) => {
  platform.request.mockResolvedValue(response({ ...refund, refund_type, _status: { _msg: '商家审核中,请耐心等待' } }));
  expect(await getRefund('refund9')).toMatchObject({ title, amount: 25.5 });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', header: expect.objectContaining({ 'Authori-zation': 'Bearer account-a' }) }));
});
it.each([0, 7, 'bad', null])('rejects unrecognized state %s', async (refund_type) => {
  platform.request.mockResolvedValue(response({ ...refund, refund_type }));
  await expect(getRefund('refund9')).rejects.toThrow();
});
it.each([-1, 'bad', null])('rejects invalid refund amount %s', async (refund_price) => {
  platform.request.mockResolvedValue(response({ ...refund, refund_price }));
  await expect(getRefund('refund9')).rejects.toThrow();
});
