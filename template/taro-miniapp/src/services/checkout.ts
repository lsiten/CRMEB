import { ApiError, request } from './api';
import { apiAmount, apiId, apiItems, apiRecord, apiText } from './commerce-contracts';
import { parseCartItem } from './server-cart';
import type { ServerCartItem } from './server-cart';

export type CheckoutPreferences = Readonly<{
  addressId: number; shippingType: 1 | 2; couponId: number; useIntegral: boolean; mark: string;
  storeId?: number; recipient?: string; phone?: string; invoiceId?: number;
}>;
export type CheckoutSession = Readonly<{
  key: string; cartIds: string; direct: boolean; items: readonly ServerCartItem[];
  pickupEnabled: boolean; integralEnabled: boolean; usableIntegral: number; addressId: number;
  activity: Readonly<{ combinationId: number; seckill_id: number; bargainId: number; advanceId: number }>;
}>;
export type CheckoutPrice = Readonly<{ total: number; payable: number; postage: number; coupon: number; integral: number }>;
export type CheckoutSubmission = Readonly<{ key: string; preferences: CheckoutPreferences; direct: boolean; activity?: CheckoutSession['activity'] }>;

export async function confirmCheckout(input: Readonly<{ cartIds: string; direct: boolean; addressId: number; shippingType: 1 | 2 }>): Promise<CheckoutSession> {
  const cartIds = input.cartIds.split(',').map(apiId).join(',');
  const payload = await request<Readonly<{ data?: unknown }>>('/order/confirm', { method: 'POST', data: { cartId: cartIds, new: input.direct ? 1 : 0, addressId: input.addressId, shipping_type: input.shippingType } });
  const data = apiRecord(payload.data);
  const items = apiItems(data['cartInfo']).map(parseCartItem);
  if (!items.length || items.some((item) => !item.valid)) throw new ApiError('BUSINESS', '部分商品已失效，请返回购物车重新选择');
  return {
    key: apiId(data['orderKey']), cartIds, direct: input.direct, items,
    pickupEnabled: data['store_self_mention'] === true || Number(data['store_self_mention']) === 1,
    integralEnabled: data['integral_open'] === true || Number(data['integral_open']) === 1,
    usableIntegral: Number(data['usable_integral'] ?? 0), addressId: Number(apiRecord(data['addressInfo'])['id'] ?? 0),
    activity: { combinationId: Number(data['combination_id'] ?? 0), seckill_id: Number(data['seckill_id'] ?? 0), bargainId: Number(data['bargain_id'] ?? 0), advanceId: Number(data['advance_id'] ?? 0) },
  };
}

export function checkoutRequest(input: CheckoutSubmission) {
  const preferences = input.preferences;
  return {
    addressId: preferences.addressId, couponId: preferences.couponId, useIntegral: preferences.useIntegral ? 1 : 0,
    shipping_type: preferences.shippingType, store_id: preferences.storeId ?? 0, real_name: preferences.recipient ?? '', phone: preferences.phone ?? '',
    mark: preferences.mark, invoice_id: preferences.invoiceId ?? 0, payType: 'weixin', new: input.direct ? 1 : 0, ...input.activity,
  };
}

export async function computeCheckout(input: CheckoutSubmission): Promise<CheckoutPrice | Readonly<{ existingOrderId: string }>> {
  const payload = await request<Readonly<{ data?: unknown }>>(`/order/computed/${apiId(input.key)}`, { method: 'POST', data: checkoutRequest(input) });
  const data = apiRecord(payload.data);
  if (data['status'] === 'EXTEND_ORDER' || data['status'] === 'ORDER_EXIST') {
    const existing = await request<Readonly<{ data?: unknown }>>(`/order/detail/${apiId(input.key)}`, { method: 'GET' });
    return { existingOrderId: apiId(apiRecord(existing.data)['order_id']) };
  }
  if (data['status'] !== 'NONE') throw new ApiError('BUSINESS', '订单状态已改变，请重新确认');
  const price = apiRecord(data['result']);
  return { total: apiAmount(price['total_price']), payable: apiAmount(price['pay_price']), postage: apiAmount(price['pay_postage']), coupon: apiAmount(price['coupon_price']), integral: apiAmount(price['deduction_price']) };
}

export async function createOrder(input: CheckoutSubmission): Promise<Readonly<{ id: string }>> {
  const payload = await request<Readonly<{ data?: unknown; msg?: string }>>(`/order/create/${apiId(input.key)}`, { method: 'POST', data: checkoutRequest(input) });
  const data = apiRecord(payload.data);
  if (data['status'] !== 'SUCCESS' && data['status'] !== 'EXTEND_ORDER' && data['status'] !== 'ORDER_EXIST') throw new ApiError('BUSINESS', payload.msg || '订单创建失败，请重试');
  return { id: apiId(apiRecord(data['result'])['orderId']) };
}

export type CheckoutCoupon = Readonly<{ id: number; title: string; amount: number; minimum: number }>;
export async function getCheckoutCoupons(input: Readonly<{ price: number; session: CheckoutSession; shippingType: 1 | 2 }>): Promise<readonly CheckoutCoupon[]> {
  const payload = await request<Readonly<{ data?: unknown }>>(`/coupons/order/${input.price}`, { method: 'GET', data: { cartId: input.session.cartIds, new: input.session.direct ? 1 : 0, shippingType: input.shippingType } });
  return apiItems(payload.data).map((value) => {
    const row = apiRecord(value);
    return { id: Number(apiId(row['id'])), title: apiText(row['coupon_title']), amount: apiAmount(row['coupon_price']), minimum: apiAmount(row['use_min_price']) };
  });
}
