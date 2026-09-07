import { beforeEach, describe, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { createOrder } from '../src/services/api';

beforeEach(() => vi.clearAllMocks());
describe('server checkout creation', () => {
  it('submits the confirmed key and address ID rather than client prices', async () => {
    platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { status: 'SUCCESS', result: { orderId: 'wx123' } } } });
    const result = await createOrder({ key: 'confirmed-key', preferences: { addressId: 9, shippingType: 1, couponId: 0, useIntegral: false, mark: '' }, direct: false });
    expect(result).toEqual({ id: 'wx123' });
    expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/create/confirmed-key'), data: expect.objectContaining({ addressId: 9, shipping_type: 1, new: 0 }) }));
    expect(platform.request.mock.calls[0]?.[0].data).not.toHaveProperty('items');
  });
  it('recognizes an already-created order when retrying the same key', async () => {
    platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data: { status: 'EXTEND_ORDER', result: { orderId: 'wx-existing' } } } });
    await expect(createOrder({ key: 'confirmed-key', preferences: { addressId: 9, shippingType: 1, couponId: 0, useIntegral: false, mark: '' }, direct: false })).resolves.toEqual({ id: 'wx-existing' });
  });
});
