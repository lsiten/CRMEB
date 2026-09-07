import { ApiError, request } from './api';
import type { Product } from './api';
import type { CartItem } from './cart';
import { apiAmount, apiId, apiItems, apiRecord, apiText } from './commerce-contracts';

export type ServerCartItem = Readonly<CartItem & { cartId: string; valid: boolean }>;
export type CartPage = Readonly<{ items: readonly ServerCartItem[]; hasMore: boolean }>;
export type CartAddInput = Readonly<{ product: Product; quantity: number; direct: boolean; activity?: Readonly<{ kind: string; id: number; pinkId?: number }> }>;

export function parseCartItem(value: unknown): ServerCartItem {
  const row = apiRecord(value);
  const product = apiRecord(row['productInfo']);
  const attr = apiRecord(product['attrInfo']);
  const cartId = apiId(row['id']);
  const id = Number(product['id'] ?? row['product_id']);
  const quantity = Number(row['cart_num']);
  const valid = Number(row['is_valid'] ?? 1) === 1 && Number(row['status'] ?? 1) === 1;
  const name = apiText(product['store_name']);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(quantity) || quantity < 1) throw new ApiError('BUSINESS', '购物车商品信息不完整');
  const stock = valid ? Number(row['trueStock'] ?? attr['stock'] ?? product['stock']) : 0;
  if (!Number.isSafeInteger(stock) || stock < 0) throw new ApiError('BUSINESS', '购物车库存信息不完整');
  return {
    cartId, id, quantity, valid, stock, name: name || '商品已失效',
    image: apiText(attr['image'] ?? product['image']), price: apiAmount(row['truePrice'] ?? attr['price'] ?? product['price'] ?? (valid ? undefined : 0)),
    spec: apiText(attr['suk']) || '默认规格', unique: apiText(row['product_attr_unique'] ?? attr['unique']),
  };
}

export async function getServerCart(query: Readonly<{ page: number; valid: boolean }>): Promise<CartPage> {
  const payload = await request<Readonly<{ data?: unknown }>>('/cart/list', { method: 'GET', data: { page: query.page, limit: 20, status: query.valid ? 1 : 0 } });
  const data = apiRecord(payload.data);
  const items = apiItems(data[query.valid ? 'valid' : 'invalid']).map(parseCartItem);
  return { items, hasMore: items.length === 20 };
}

export async function addServerCart(input: CartAddInput): Promise<string> {
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1) throw new ApiError('BUSINESS', '请选择正确的商品数量');
  const activityKeys: Readonly<Record<string, string>> = { combination: 'combinationId', seckill: 'secKillId', bargain: 'bargainId', advance: 'advanceId' };
  const activityKey = input.activity ? activityKeys[input.activity.kind] : undefined;
  if (input.activity && !activityKey) throw new ApiError('BUSINESS', '该活动不能通过普通商品下单');
  const payload = await request<Readonly<{ data?: unknown }>>('/cart/add', {
    method: 'POST', data: {
      productId: input.product.id, cartNum: input.quantity, uniqueId: input.product.unique ?? '', new: input.direct ? 1 : 0,
      ...(activityKey && input.activity ? { [activityKey]: input.activity.id, pinkId: input.activity.pinkId ?? 0 } : {}),
    },
  });
  return apiId(apiRecord(payload.data)['cartId']);
}

export async function changeServerCartQuantity(cartId: string, quantity: number): Promise<void> {
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw new ApiError('BUSINESS', '商品数量至少为1');
  await request('/cart/num', { method: 'POST', data: { id: apiId(cartId), number: quantity } });
}

export async function deleteServerCart(cartIds: readonly string[]): Promise<void> {
  if (!cartIds.length) return;
  await request('/cart/del', { method: 'POST', data: { ids: cartIds.map(apiId).join(',') } });
}
