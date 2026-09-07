import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { applyRefund, cancelRefund, deleteRefund, getRefund, getRefundEligibility, getRefundProducts, getRefundReasons, getRefunds, submitRefundExpress } from '../src/services/refunds';
import { buyOrderAgain, deleteOrder, receiveOrder } from '../src/services/order-actions';

const product = { id: 'cart81', cart_num: 2, productInfo: { store_name: '咖啡', image: '/coffee.png', attrInfo: { suk: '深烘焙' } } };
const refund = { id: 9, order_id: 'refund9', store_order_order_id: 'order81', refund_type: 4, refund_price: '25.50', cart_info: [product], refund_img: ['https://example.test/proof.png'], _status: { _title: '申请退款中', refund_address: '退货仓库', refund_name: '售后', refund_phone: '13800000000' }, express_list: [{ name: '顺丰速运' }] };
beforeEach(() => vi.clearAllMocks());
function respond(data: unknown) { platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data } }); }
it('reads the refund list envelope and distinguishes waiting-for-return from pending approval', async () => {
  respond({ list: [refund], count: 1 });
  await expect(getRefunds()).resolves.toMatchObject([{ id: 'refund9', internalId: 9, orderId: 'order81', type: 4, title: '请寄回商品', amount: 25.5 }]);
});
it('reads return instructions, proof and carrier options from detail', async () => {
  respond(refund);
  await expect(getRefund('refund9')).resolves.toMatchObject({ returnAddress: '退货仓库', images: ['https://example.test/proof.png'], expressOptions: ['顺丰速运'], products: [{ cartId: 'cart81', remaining: 2, spec: '深烘焙' }] });
});
it('excludes fully refunded rows still returned by the backend', async () => {
  respond([{ cart_id: 'cart81', cart_info: product, cart_num: 2, refund_num: 1, surplus_num: 1 }, { cart_id: 'cart82', cart_info: product, cart_num: 2, refund_num: 2 }]);
  await expect(getRefundProducts(81)).resolves.toMatchObject([{ cartId: 'cart81', remaining: 1 }]);
});
it('uses internal order ID and selected quantities for eligibility', async () => {
  respond({ _status: { _is_back: true } });
  await expect(getRefundEligibility(81, [{ cartId: 'cart81', quantity: 1 }])).resolves.toEqual({ allowReturn: true });
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { id: 81, cart_ids: [{ cart_id: 'cart81', cart_num: 1 }] } }));
});
it('loads configured reasons and leaves refund pricing to the server', async () => {
  respond(['商品损坏']);
  await expect(getRefundReasons()).resolves.toEqual(['商品损坏']);
  respond({});
  await applyRefund({ orderId: 81, selection: [{ cartId: 'cart81', quantity: 1 }], reason: '商品损坏', explanation: '包装破损', images: ['https://example.test/proof.png'], type: 2 });
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/refund/apply/81'), method: 'POST', data: { text: '商品损坏', refund_reason_wap_explain: '包装破损', refund_reason_wap_img: 'https://example.test/proof.png', refund_type: 2, cart_ids: [{ cart_id: 'cart81', cart_num: 1 }] } }));
});
it('rejects duplicate selections and invalid quantities before requesting', async () => {
  await expect(getRefundEligibility(81, [{ cartId: 'cart81', quantity: 0 }])).rejects.toMatchObject({ code: 'BUSINESS' });
  await expect(getRefundEligibility(81, [{ cartId: 'cart81', quantity: 1 }, { cartId: 'cart81', quantity: 1 }])).rejects.toMatchObject({ code: 'BUSINESS' });
  expect(platform.request).not.toHaveBeenCalled();
});
it('does not turn malformed lists and unknown statuses into empty or successful states', async () => {
  respond({});
  await expect(getRefunds()).rejects.toMatchObject({ code: 'BUSINESS' });
  respond({ ...refund, refund_type: 99 });
  await expect(getRefund('refund9')).rejects.toMatchObject({ code: 'BUSINESS' });
});
it('uses refund number for cancellation and deletion, internal refund ID for express', async () => {
  respond({});
  await cancelRefund('refund9');
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/refund/cancel/refund9'), method: 'POST' }));
  await deleteRefund('refund9');
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/refund/del/refund9'), method: 'GET' }));
  await submitRefundExpress({ id: 9, company: '顺丰速运', number: 'SF123', phone: '13800000000', explanation: '原申请说明', images: ['https://example.test/proof.png'] });
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: 9, refund_express: 'SF123', refund_express_name: '顺丰速运' }) }));
});
it('uses uni for receiving, deletion and repeat purchase and rejects missing temporary carts', async () => {
  respond({});
  await receiveOrder('order81');
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/take'), data: { uni: 'order81' } }));
  await deleteOrder('order81');
  expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/del'), data: { uni: 'order81' } }));
  await expect(buyOrderAgain('order81')).rejects.toMatchObject({ code: 'BUSINESS' });
  respond({ cateId: 'cart81,cart82' });
  await expect(buyOrderAgain('order81')).resolves.toBe('cart81,cart82');
});
it('propagates rejected applications without reporting success', async () => {
  platform.request.mockResolvedValue({ statusCode: 200, data: { status: 400, msg: '存在待处理退款单' } });
  await expect(applyRefund({ orderId: 81, selection: [{ cartId: 'cart81', quantity: 1 }], reason: '损坏', explanation: '破损', images: [], type: 1 })).rejects.toThrow('存在待处理退款单');
});
