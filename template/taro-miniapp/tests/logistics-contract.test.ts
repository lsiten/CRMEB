import { beforeEach, expect, it, vi } from 'vitest';
const platform = vi.hoisted(() => ({ request: vi.fn(), getStorageSync: () => 'session', removeStorageSync: vi.fn() }));
vi.mock('@tarojs/taro', () => ({ default: platform }));
vi.mock('../src/services/telemetry', () => ({ track: vi.fn() }));
import { getShipment } from '../src/services/logistics';
beforeEach(() => vi.clearAllMocks());
function respond(data: unknown) { platform.request.mockResolvedValue({ statusCode: 200, data: { status: 200, data } }); }
it('loads return tracking with the refund identity and retains parcel goods without product ids', async () => {
  // Given: the refund express response intentionally omits product ids.
  respond({ order: { delivery_name: '顺丰速运', delivery_id: 'SF001', cartInfo: [{ cart_num: 2, truePrice: '10', postage_price: '4', productInfo: { store_name: '咖啡', image: '/coffee.png' } }] }, express: { result: { list: [{ time: '2026-09-07', status: '已揽收' }] } } });
  // When: the shopper opens their return parcel.
  const shipment = await getShipment('refund001', true);
  // Then: refund routing and the displayed parcel details follow the server contract.
  expect(platform.request).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('/order/express/refund001/refund') }));
  expect(shipment).toEqual({ company: '顺丰速运', number: 'SF001', products: [{ name: '咖啡', image: '/coffee.png', quantity: 2, price: 12 }], events: [{ time: '2026-09-07', description: '已揽收' }] });
});
it('retains parcel information when the carrier has no tracking result yet', async () => {
  // Given: a valid parcel has not produced carrier events.
  respond({ order: { delivery_name: '顺丰速运', delivery_id: 'SF001', cartInfo: [] }, express: {} });
  // When / Then: this is an empty timeline, not a failed request.
  await expect(getShipment('wx001')).resolves.toMatchObject({ number: 'SF001', events: [] });
});
it('rejects a missing order identity before sending a request', async () => {
  // Given / When / Then: malformed navigation must not request another route.
  await expect(getShipment('')).rejects.toMatchObject({ code: 'BUSINESS' });
  expect(platform.request).not.toHaveBeenCalled();
});
it('rejects malformed event lists instead of showing a false empty timeline', async () => {
  // Given: the carrier response violates its list contract.
  respond({ order: { delivery_id: 'SF001', cartInfo: [] }, express: { result: { list: {} } } });
  // When / Then: the caller can render an error and retry.
  await expect(getShipment('wx001')).rejects.toMatchObject({ code: 'BUSINESS' });
});
