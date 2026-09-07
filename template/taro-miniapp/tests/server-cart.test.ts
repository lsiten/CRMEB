import { beforeEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session' }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { addServerCart, changeServerCartQuantity, deleteServerCart, getServerCart } from '../src/services/server-cart';
import { computeCheckout, confirmCheckout, getCheckoutCoupons } from '../src/services/checkout';
const item = { id: '19', cart_num: 2, truePrice: '12', trueStock: 3, is_valid: 1, product_attr_unique: 'sku19', productInfo: { id: 7, store_name: '咖啡', image: '/coffee.png', attrInfo: { suk: '热', stock: 3 } } };
const preferences = { addressId: 9, shippingType: 1, couponId: 2, useIntegral: true, mark: '周末配送' } as const;
beforeEach(() => vi.resetAllMocks());
const respond = (data: unknown) => platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data } });

describe('server cart and quotation', () => {
  it('recovers the canonical order ID after an accepted create timed out', async () => {
    platform.request.mockResolvedValueOnce({ statusCode: 200, data: { status: 200, data: { status: 'EXTEND_ORDER', result: { orderId: 'confirmed-key', key: 'confirmed-key' } } } });
    platform.request.mockResolvedValueOnce({ statusCode: 200, data: { status: 200, data: { order_id: 'wx-created' } } });
    await expect(computeCheckout({ key: 'confirmed-key', preferences, direct: false })).resolves.toEqual({ existingOrderId: 'wx-created' });
    expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/detail/confirmed-key'), method: 'GET' }));
  });
  it('loads paginated server cart and normalizes SKU identity', async () => {
    respond({ valid: [item], invalid: [] });
    await expect(getServerCart({ page: 2, valid: true })).resolves.toMatchObject({ items: [{ cartId: '19', id: 7, unique: 'sku19', spec: '热', quantity: 2, stock: 3, price: 12 }], hasMore: false });
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/cart/list'), data: { page: 2, limit: 20, status: 1 } }));
  });
  it('keeps unavailable rows removable without pretending they are buyable', async () => {
    respond({ invalid: [{ ...item, status: 0, is_valid: 0 }] });
    await expect(getServerCart({ page: 1, valid: false })).resolves.toMatchObject({ items: [{ cartId: '19', stock: 0, valid: false }] });
  });
  it('adds to server cart with uniqueId and direct flag', async () => {
    respond({ cartId: 'direct19' });
    await expect(addServerCart({ product: { id: 7, name: '咖啡', image: '/coffee.png', price: 12, unique: 'sku19' }, quantity: 2, direct: true })).resolves.toBe('direct19');
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { productId: 7, cartNum: 2, uniqueId: 'sku19', new: 1 } }));
  });
  it('uses the server cart ID for quantity updates and deletes', async () => {
    respond({});
    await changeServerCartQuantity('19', 3);
    expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: { id: '19', number: 3 } }));
    await deleteServerCart(['19', '20']);
    expect(platform.request).toHaveBeenLastCalledWith(expect.objectContaining({ data: { ids: '19,20' } }));
  });
  it('confirms cart IDs and preserves the backend orderKey for subsequent requests', async () => {
    respond({ orderKey: 'key19', cartInfo: [item], addressInfo: { id: 9 }, store_self_mention: 1, integral_open: true, usable_integral: 100 });
    await expect(confirmCheckout({ cartIds: '19', direct: false, addressId: 9, shippingType: 1 })).resolves.toMatchObject({ key: 'key19', cartIds: '19', pickupEnabled: true, addressId: 9 });
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { cartId: '19', new: 0, addressId: 9, shipping_type: 1 } }));
  });
  it('uses backend payable and postage rather than client arithmetic', async () => {
    respond({ status: 'NONE', result: { total_price: '24', pay_price: '23', pay_postage: '5', coupon_price: '4', deduction_price: '2' } });
    await expect(computeCheckout({ key: 'key19', preferences, direct: false })).resolves.toEqual({ total: 24, payable: 23, postage: 5, coupon: 4, integral: 2 });
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ addressId: 9, couponId: 2, useIntegral: 1, mark: '周末配送' }) }));
  });
  it('passes selected carts and shippingType when looking up usable coupons', async () => {
    respond([]);
    await getCheckoutCoupons({ price: 24, shippingType: 1, session: { key: 'key19', cartIds: '19', direct: false, items: [], pickupEnabled: true, integralEnabled: true, usableIntegral: 100, addressId: 9, activity: { combinationId: 0, seckill_id: 0, bargainId: 0, advanceId: 0 } } });
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ data: { cartId: '19', new: 0, shippingType: 1 } }));
  });
});
