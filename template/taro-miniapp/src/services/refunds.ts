import { ApiError, request } from './api';
import { apiAmount, apiId, apiItems, apiRecord, apiText } from './commerce-contracts';

export type RefundSelection = Readonly<{ cartId: string; quantity: number }>;
export type RefundProduct = Readonly<{ cartId: string; name: string; image: string; spec: string; remaining: number }>;
export type RefundApplication = Readonly<{ orderId: number; selection: readonly RefundSelection[]; reason: string; explanation: string; images: readonly string[]; type: 1 | 2 }>;
export type Refund = Readonly<{ id: string; internalId: number; orderId: string; type: number; title: string; message: string; amount: number; reason: string; explanation: string; images: readonly string[]; createdAt: string; products: readonly RefundProduct[]; returnAddress: string; returnName: string; returnPhone: string; express: string; expressName: string; expressOptions: readonly string[] }>;

function internalId(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new ApiError('BUSINESS', '订单标识无效，请重新打开订单');
  return value;
}
function selectionData(selection: readonly RefundSelection[]) {
  if (!selection.length) throw new ApiError('BUSINESS', '请选择售后商品');
  if (new Set(selection.map((item) => item.cartId)).size !== selection.length) throw new ApiError('BUSINESS', '售后商品不能重复');
  return selection.map((item) => ({ cart_id: apiId(item.cartId), cart_num: internalId(item.quantity) }));
}
function parseProduct(value: unknown): RefundProduct {
  const row = apiRecord(value);
  const cart = row['cart_info'] ? apiRecord(row['cart_info']) : row;
  const product = apiRecord(cart['productInfo']);
  const name = apiText(product['store_name']);
  if (!name) throw new ApiError('BUSINESS', '售后商品信息不完整，请重试');
  return { cartId: apiId(row['cart_id'] ?? cart['id']), name, image: apiText(product['image']), spec: apiText(apiRecord(product['attrInfo'])['suk']), remaining: Math.max(0, Number(row['surplus_num'] ?? Number(row['cart_num'] ?? cart['cart_num']) - Number(row['refund_num'] ?? 0))) };
}
export async function getRefundProducts(orderId: number): Promise<readonly RefundProduct[]> {
  const payload = apiRecord(await request<unknown>(`/order/refund/cart_info/${internalId(orderId)}`, { method: 'GET' }));
  return apiItems(payload['data']).map(parseProduct).filter((item) => Number.isSafeInteger(item.remaining) && item.remaining > 0);
}
export async function getRefundReasons(): Promise<readonly string[]> {
  const payload = apiRecord(await request<unknown>('/order/refund/reason', { method: 'GET' }));
  return apiItems(payload['data']).map(apiText).filter(Boolean);
}
export async function getRefundEligibility(orderId: number, selection: readonly RefundSelection[]): Promise<Readonly<{ allowReturn: boolean }>> {
  const payload = apiRecord(await request<unknown>('/order/refund/cart_info', { method: 'POST', data: { id: internalId(orderId), cart_ids: selectionData(selection) } }));
  const status = apiRecord(apiRecord(payload['data'])['_status']);
  return { allowReturn: status['_is_back'] === true || status['_is_back'] === 1 };
}
export async function applyRefund(input: RefundApplication): Promise<void> {
  if (!input.reason.trim() || !input.explanation.trim()) throw new ApiError('BUSINESS', '请选择退款原因并填写说明');
  if (input.images.length > 3 || input.images.some((url) => !/^https?:\/\//i.test(url))) throw new ApiError('BUSINESS', '最多上传3张有效图片凭证');
  await request(`/order/refund/apply/${internalId(input.orderId)}`, { method: 'POST', data: { text: input.reason, refund_reason_wap_explain: input.explanation, refund_reason_wap_img: input.images.join(','), refund_type: input.type, cart_ids: selectionData(input.selection) } });
}
function parseRefund(value: unknown): Refund {
  const row = apiRecord(value); const status = apiRecord(row['_status']);
  const products = row['cartInfo'] ?? row['cart_info'];
  const images = row['refund_img'];
  const type = Number(row['refund_type']);
  if (!Number.isSafeInteger(type) || type < 1 || type > 6) throw new ApiError('BUSINESS', '售后状态不完整，请重试');
  const titles: Readonly<Record<number, string>> = { 1: '退款审核中', 2: '退货审核中', 3: '退款被拒绝', 4: '请寄回商品', 5: '等待商家收货退款', 6: '已退款' };
  return { id: apiId(row['order_id']), internalId: internalId(Number(row['id'])), orderId: apiText(row['store_order_sn'] ?? row['store_order_order_id']), type, title: titles[type] ?? apiText(status['_title']), message: apiText(row['refuse_reason']) || apiText(status['_msg']), amount: apiAmount(row['refund_price'] ?? row['pay_price']), reason: apiText(row['refund_reason']), explanation: apiText(row['refund_explain']), images: Array.isArray(images) ? images.map(apiText).filter(Boolean) : [], createdAt: apiText(row['_add_time'] ?? row['add_time']), products: apiItems(products).map(parseProduct), returnAddress: apiText(status['refund_address']), returnName: apiText(status['refund_name']), returnPhone: apiText(status['refund_phone']), express: apiText(row['refund_express']), expressName: apiText(row['refund_express_name']), expressOptions: Array.isArray(row['express_list']) ? row['express_list'].map((entry: unknown) => apiText(apiRecord(entry)['name'])).filter(Boolean) : [] };
}
export async function getRefunds(page = 1): Promise<readonly Refund[]> {
  const payload = apiRecord(await request<unknown>('/order/refund/list', { method: 'GET', data: { page, limit: 20 } }));
  return apiItems(apiRecord(payload['data'])['list']).map(parseRefund);
}
export async function getRefund(refundId: string): Promise<Refund> {
  const payload = apiRecord(await request<unknown>(`/order/refund/detail/${apiId(refundId)}`, { method: 'GET' }));
  return parseRefund(payload['data']);
}
export async function cancelRefund(refundId: string): Promise<void> { await request(`/order/refund/cancel/${apiId(refundId)}`, { method: 'POST' }); }
export async function deleteRefund(refundId: string): Promise<void> { await request(`/order/refund/del/${apiId(refundId)}`, { method: 'GET' }); }
export async function submitRefundExpress(input: Readonly<{ id: number; company: string; number: string; phone: string; explanation: string; images: readonly string[] }>): Promise<void> {
  if (!input.company.trim() || !input.number.trim() || !/^1\d{10}$/.test(input.phone)) throw new ApiError('BUSINESS', '请填写快递公司、单号和正确的手机号');
  await request('/order/refund/express', { method: 'POST', data: { id: internalId(input.id), refund_express_name: input.company, refund_express: input.number, refund_phone: input.phone, refund_explain: input.explanation, refund_img: input.images.join(',') } });
}
