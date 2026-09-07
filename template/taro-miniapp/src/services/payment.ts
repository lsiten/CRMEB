import { ApiError, request } from './api';
import { apiAmount, apiId, apiRecord, apiText, type ApiRecord } from './commerce-contracts';
import type { ServerPaymentStatus } from './platform';

export type PaymentMethod = 'wechat' | 'alipay' | 'balance' | 'offline';
export type PaymentParams = Readonly<{ orderId: string; method: PaymentMethod; quitUrl?: string }>;
export type PaymentResponse = Readonly<{ orderId: string; status: string; payParams: ApiRecord; payKey: string; payUrl: string; form: string }>;
export type Cashier = Readonly<{ orderId: string; amount: number; balance: number; expiresAt: number; methods: readonly PaymentMethod[] }>;
const enabled = (value: unknown): boolean => value === true || value === 1 || value === '1';

export async function getCashier(orderId: string): Promise<Cashier> {
  const envelope = apiRecord(await request<unknown>(`/order/cashier/${apiId(orderId)}/order`, { method: 'GET' }));
  const data = apiRecord(envelope['data']);
  const methods: PaymentMethod[] = [];
  if (enabled(data['wechat_pay_status'])) methods.push('wechat');
  if (enabled(data['ali_pay_status'])) methods.push('alipay');
  if (enabled(data['yue_pay_status'])) methods.push('balance');
  if (enabled(data['offline_pay_status'])) methods.push('offline');
  return { orderId: apiId(data['order_id']), amount: apiAmount(data['pay_price']), balance: apiAmount(data['now_money']), expiresAt: apiAmount(data['invalid_time']), methods };
}

export async function requestPayment(params: PaymentParams): Promise<PaymentResponse> {
  const paytypes = { wechat: 'weixin', alipay: 'alipay', balance: 'yue', offline: 'offline' };
  const envelope = apiRecord(await request<unknown>('/order/pay', { method: 'POST', data: { uni: apiId(params.orderId), paytype: paytypes[params.method], type: 0, ...(params.quitUrl ? { quitUrl: params.quitUrl } : {}) } }));
  const data = apiRecord(envelope['data']);
  const status = apiText(data['status']);
  if (!['SUCCESS', 'WECHAT_PAY', 'WECHAT_H5_PAY', 'WECHAT_PC_PAY', 'ALIPAY_PAY', 'ALLINPAY_PAY'].includes(status)) throw new ApiError('BUSINESS', apiText(envelope['msg']) || '支付发起失败，请重试');
  const result = apiRecord(data['result']);
  return { orderId: apiId(result['order_id'] ?? params.orderId), status, payParams: apiRecord(result['jsConfig']), payKey: apiText(result['pay_key']), payUrl: apiText(result['pay_url']), form: typeof result['jsConfig'] === 'string' ? result['jsConfig'] : '' };
}

export async function queryPayment(orderId: string): Promise<Readonly<{ status: ServerPaymentStatus }>> {
  const envelope = apiRecord(await request<unknown>(`/order/detail/${apiId(orderId)}`, { method: 'GET' }));
  const data = apiRecord(envelope['data']);
  if (enabled(data['paid'])) return { status: 'paid' };
  if (enabled(data['is_cancel']) || enabled(data['is_del']) || enabled(data['is_system_del'])) return { status: 'cancelled' };
  if (data['paid'] === 0 || data['paid'] === '0' || data['paid'] === false) return { status: 'pending' };
  throw new ApiError('BUSINESS', '支付状态数据不完整，请刷新确认');
}
