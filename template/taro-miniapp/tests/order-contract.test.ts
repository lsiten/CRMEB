import { beforeEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { cancelOrder, getLogistics, getOrder, getOrders } from '../src/services/api';

const serverOrder = {
  id: 81, order_id: 'wx2026001', paid: 1, status: 1,
  _status: { _type: 2, _title: '待收货' }, pay_price: '42.50',
  real_name: '收件人', user_phone: '13800000000', user_address: '浙江省嘉兴市测试地址',
  cartInfo: [{ id: '100', cart_num: 2, truePrice: '21.25', productInfo: { id: 7, store_name: '咖啡', image: '/coffee.png' } }],
};
beforeEach(() => vi.clearAllMocks());
function respond(data: unknown) { platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data } }); }

describe('existing CRMEB order contracts', () => {
  it('exposes the order-line review unique independently of the product SKU unique', async () => {
    respond({ ...serverOrder, cartInfo: [{ ...serverOrder.cartInfo[0], unique: 'order-line81', is_reply: 0, productInfo: { id: 7, store_name: '咖啡', attrInfo: { unique: 'sku-unique', suk: '深烘焙' } } }] });
    await expect(getOrder('wx2026001')).resolves.toMatchObject({ items: [{ reviewUnique: 'order-line81', reviewed: false }] });
  });
  it('retains waiting-for-review as its own tab and requires server permission for refunds', async () => {
    respond([{ ...serverOrder, _status: { _type: 3, _title: '待评价' }, is_apply_refund: 1, is_refund_available: 1, refund_status: 0 }]);
    await expect(getOrders('review')).resolves.toMatchObject([{ status: 'review', internalId: 81, canRefund: true }]);
    expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 3 }) }));
    respond({ ...serverOrder, is_apply_refund: 1, is_refund_available: 0, refund_status: 0 });
    await expect(getOrder('wx2026001')).resolves.toMatchObject({ canRefund: false });
  });
  it('loads the real list endpoint with its numeric type filter', async () => {
    respond([serverOrder]);
    const orders = await getOrders('shipping');
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/list'), data: expect.objectContaining({ type: 2 }) }));
    expect(orders[0]).toMatchObject({ id: 'wx2026001', status: 'shipping', total: 42.5, items: [{ id: 7, name: '咖啡', quantity: 2, price: 21.25 }] });
  });
  it('normalizes detail identity and address from backend fields', async () => {
    respond(serverOrder);
    const order = await getOrder('wx2026001');
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/detail/wx2026001') }));
    expect(order.address).toEqual({ name: '收件人', phone: '13800000000', detail: '浙江省嘉兴市测试地址' });
  });
  it('sends cancellation using the backend id field', async () => {
    respond({});
    await cancelOrder('wx2026001');
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/cancel'), method: 'POST', data: { id: 'wx2026001' } }));
  });
  it('extracts the nested express result list', async () => {
    respond({ express: { result: { list: [{ time: '2026-09-06 12:00', status: '已签收' }] } } });
    await expect(getLogistics('wx2026001')).resolves.toEqual([{ time: '2026-09-06 12:00', description: '已签收' }]);
  });
  it('rejects malformed details instead of displaying a zero-price order', async () => {
    respond({ order_id: 'broken', pay_price: 'invalid' });
    await expect(getOrder('broken')).rejects.toMatchObject({ code: 'BUSINESS' });
  });
  it('retains cancelled status even when the computed type is completed', async () => {
    respond({ ...serverOrder, is_cancel: 1, _status: { _type: 4 } });
    await expect(getOrder('wx2026001')).resolves.toMatchObject({ status: 'cancelled' });
  });
});
