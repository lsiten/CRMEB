import { ApiError, request } from './api';
import type { Order, OrderItem, OrderStatus } from './api';

type Row = Readonly<Record<string, unknown>>;
const rowOf = (value: unknown): Row => typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
const text = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
const amount = (value: unknown): number => typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
const states: Readonly<Record<string, OrderStatus>> = {
  '0': 'unpaid', '9': 'unpaid', '1': 'paid', '2': 'shipping', '3': 'review', '4': 'completed', '-1': 'refunding', '-2': 'refunded',
};
const filters: Readonly<Record<OrderStatus, number | ''>> = {
  pending: '', unpaid: 0, paid: 1, shipping: 2, review: 3, completed: 4, cancelled: '', refunding: -1, refunded: -2,
};

function parseItem(value: unknown): OrderItem {
  const row = rowOf(value);
  const product = rowOf(row['productInfo']);
  const id = amount(product['id']);
  const name = text(product['store_name']);
  const price = amount(row['truePrice'] ?? product['price']);
  const quantity = amount(row['cart_num']);
  if (!Number.isSafeInteger(id) || id <= 0 || !name || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(quantity) || quantity < 1) {
    throw new ApiError('BUSINESS', '订单商品数据不完整，请重试');
  }
  return { id, name, price, quantity, image: text(product['image']), cartId: text(row['id']), reviewUnique: text(row['unique']), ...(row['is_reply'] !== undefined ? { reviewed: Number(row['is_reply']) > 0 } : {}), spec: text(rowOf(product['attrInfo'])['suk']) };
}

function parseOrder(value: unknown): Order {
  const row = rowOf(value);
  const id = text(row['order_id']);
  const total = amount(row['pay_price']);
  const state = rowOf(row['_status']);
  const status = Number(row['is_cancel']) === 1 ? 'cancelled' : states[text(state['_type'])];
  const items = row['cartInfo'];
  if (!id || !Number.isFinite(total) || total < 0 || !status || !Array.isArray(items)) {
    throw new ApiError('BUSINESS', '订单数据不完整，请重试');
  }
  const detail = text(row['user_address']);
  const split = row['split'];
  if (split !== undefined && !Array.isArray(split)) throw new ApiError('BUSINESS', '拆单数据不完整，请重试');
  const splitOrderIds = Array.isArray(split) ? split.map((child: unknown) => text(rowOf(child)['order_id'])) : [];
  if (splitOrderIds.some((child) => !child || child === id)) throw new ApiError('BUSINESS', '拆单数据不完整，请重试');
  const splitParent = splitOrderIds.length > 0 || row['delivery_type'] === 'split';
  const type = text(state['_type']);
  const cancelled = status === 'cancelled';
  return {
    id, total, status, statusText: status === 'cancelled' ? '已取消' : text(state['_title']),
    statusMessage: text(state['_msg']), splitOrderIds,
    canPay: !cancelled && type === '0' && Number(row['paid']) === 0,
    canCancel: !cancelled && ['0', '9'].includes(type) && Number(row['paid']) === 0,
    canReceive: !cancelled && type === '2' && !splitParent,
    canDelete: (type === '4' && !splitParent) || type === '-2',
    ...(Number.isSafeInteger(Number(row['id'])) && Number(row['id']) > 0 ? { internalId: Number(row['id']) } : {}),
    canRefund: (row['is_apply_refund'] === true || Number(row['is_apply_refund']) === 1) && (row['is_refund_available'] === true || Number(row['is_refund_available']) === 1) && Number(row['refund_status']) === 0,
    canBuyAgain: Number(row['paid']) === 1 && Number(row['is_gift'] ?? 0) === 0 && status !== 'cancelled' && !['combination_id', 'bargain_id', 'seckill_id', 'advance_id'].some((key) => Number(row[key]) > 0),
    deliveryType: text(row['delivery_type']),
    items: items.map(parseItem), createdAt: text(row['_add_time'] ?? row['add_time']),
    ...(detail ? { address: { name: text(row['real_name']), phone: text(row['user_phone']), detail } } : {}),
  };
}

export async function getOrders(status?: OrderStatus, page = 1): Promise<readonly Order[]> {
  const payload = await request<Readonly<{ data?: unknown }>>('/order/list', {
    method: 'GET', data: { type: status ? filters[status] : '', page, limit: 20 },
  });
  if (!Array.isArray(payload.data)) throw new ApiError('BUSINESS', '订单列表数据不完整，请重试');
  const orders = payload.data.map(parseOrder);
  return status === 'cancelled' ? orders.filter((order) => order.status === status) : orders;
}

export async function getOrder(orderId: string): Promise<Order> {
  const payload = await request<Readonly<{ data?: unknown }>>(`/order/detail/${encodeURIComponent(orderId)}`, { method: 'GET' });
  return parseOrder(payload.data);
}

export async function cancelOrder(orderId: string): Promise<void> {
  await request('/order/cancel', { method: 'POST', data: { id: orderId } });
}

export async function getLogistics(orderId: string): Promise<readonly Readonly<{ time: string; description: string }>[]> {
  const payload = await request<Readonly<{ data?: unknown }>>(`/order/express/${encodeURIComponent(orderId)}`, { method: 'GET' });
  const result = rowOf(rowOf(rowOf(payload.data)['express'])['result']);
  const entries = result['list'];
  if (!Array.isArray(entries)) throw new ApiError('BUSINESS', '物流数据不完整，请重试');
  return entries.map((value: unknown) => {
    const row = rowOf(value);
    return { time: text(row['time']), description: text(row['status'] ?? row['context']) };
  });
}
