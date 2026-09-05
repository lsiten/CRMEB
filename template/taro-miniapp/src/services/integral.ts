import { ApiError, request } from './api';

export type IntegralProduct = Readonly<{
  id: number; product_id?: number; unique?: string; name: string; image: string;
  integral: number; stock: number; sales?: number; description?: string; specs?: readonly string[];
}>;
export type IntegralOrder = Readonly<{
  orderId: string; status: string; statusText?: string; integral: number; image?: string;
  productName?: string; quantity: number; createdAt?: string; address?: string;
}>;
export type IntegralHome = Readonly<{ banner: readonly Readonly<{ image: string; url?: string }>[]; list: readonly IntegralProduct[] }>;
type Envelope<T> = Readonly<{ data?: T }>;

const unwrap = <T>(payload: T | Envelope<T>): T =>
  typeof payload === 'object' && payload !== null && 'data' in payload ? (payload as Envelope<T>).data as T : payload as T;

const numberValue = (value: unknown, fallback = 0): number => {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
};

const parseProduct = (value: unknown): IntegralProduct | null => {
  if (typeof value !== 'object' || value === null) return null;
  const item = value as Record<string, unknown>;
  const id = numberValue(item['id'] ?? item['product_id']);
  const name = String(item['store_name'] ?? item['name'] ?? '').trim();
  const image = String(item['image'] ?? item['image_input'] ?? '').trim();
  if (!Number.isSafeInteger(id) || id <= 0 || !name || !image) return null;
  const result: { id: number; name: string; image: string; integral: number; stock: number; product_id?: number; unique?: string; sales?: number; description?: string } = { id, name, image, integral: numberValue(item['integral'] ?? item['price'] ?? item['integral_price']), stock: numberValue(item['stock'], 0) };
  const productId = numberValue(item['product_id']); if (productId) result.product_id = productId;
  if (typeof item['unique'] === 'string') result.unique = item['unique'];
  const sales = numberValue(item['sales']); if (sales) result.sales = sales;
  if (typeof item['description'] === 'string') result.description = item['description'];
  return result;
};

const parseProducts = (value: unknown): readonly IntegralProduct[] => {
  const list = Array.isArray(value) ? value : typeof value === 'object' && value !== null && Array.isArray((value as Record<string, unknown>)['list']) ? (value as Record<string, unknown>)['list'] : [];
  return (list as readonly unknown[]).flatMap((item: unknown) => { const product = parseProduct(item); return product ? [product] : []; });
};

export async function getIntegralHome(): Promise<IntegralHome> {
  const payload = unwrap(await request<IntegralHome | Envelope<IntegralHome>>('/store_integral/index', { method: 'GET' }));
  return { banner: Array.isArray(payload?.banner) ? payload.banner : [], list: parseProducts(payload?.list) };
}
export async function getIntegralProducts(keyword = ''): Promise<readonly IntegralProduct[]> {
  const query = keyword.trim() ? `?store_name=${encodeURIComponent(keyword.trim())}` : '';
  return parseProducts(unwrap(await request<unknown | Envelope<unknown>>(`/store_integral/list${query}`, { method: 'GET' })));
}
export async function getIntegralProduct(id: number): Promise<IntegralProduct> {
  const payload = unwrap(await request<unknown | Envelope<unknown>>(`/store_integral/detail/${encodeURIComponent(String(id))}`, { method: 'GET' }));
  const product = parseProduct(payload);
  if (!product) throw new ApiError('BUSINESS', '积分商品不存在');
  return product;
}
export async function createIntegralOrder(input: Readonly<{ addressId: number; unique: string; num: number; mark?: string }>): Promise<string> {
  const payload = await request<Envelope<Readonly<{ orderId?: string }>>>(`/store_integral/order/create`, { method: 'POST', data: input, header: { 'X-Idempotency-Key': `integral-${input.unique}-${input.addressId}-${input.num}` } });
  const orderId = payload.data?.orderId;
  if (!orderId) throw new ApiError('BUSINESS', '订单创建失败');
  return orderId;
}
export async function getIntegralOrders(): Promise<readonly IntegralOrder[]> {
  const payload = unwrap(await request<unknown | Envelope<unknown>>('/store_integral/order/list', { method: 'GET' }));
  const list = Array.isArray(payload) ? payload : [];
  return list.flatMap((item) => { if (typeof item !== 'object' || item === null) return []; const row = item as Record<string, unknown>; const orderId = String(row['order_id'] ?? row['orderId'] ?? ''); if (!orderId) return []; const order: { orderId: string; status: string; integral: number; quantity: number; statusText?: string; productName?: string; image?: string; createdAt?: string } = { orderId, status: String(row['status'] ?? row['paid'] ?? ''), integral: numberValue(row['total_price'] ?? row['integral']), quantity: numberValue(row['total_num'] ?? row['num'], 1) }; if (typeof row['status_name'] === 'string') order.statusText = row['status_name']; if (typeof row['store_name'] === 'string') order.productName = row['store_name']; if (typeof row['image'] === 'string') order.image = row['image']; if (typeof row['add_time'] === 'string') order.createdAt = row['add_time']; return [order]; });
}
export async function getIntegralLogistics(orderId: string): Promise<readonly Readonly<{ time: string; description: string }>[]> {
  const payload = unwrap(await request<Readonly<{ express?: Readonly<{ result?: Readonly<{ list?: readonly Readonly<{ time?: string; context?: string; description?: string }>[] }> }> }> | Envelope<Readonly<{ express?: Readonly<{ result?: Readonly<{ list?: readonly Readonly<{ time?: string; context?: string; description?: string }>[] }> }> }>>>(`/store_integral/order/express/${encodeURIComponent(orderId)}`, { method: 'GET' }));
  return payload?.express?.result?.list?.map((item) => ({ time: item.time ?? '', description: item.description ?? item.context ?? '' })) ?? [];
}
