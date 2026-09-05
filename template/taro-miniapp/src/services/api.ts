// @ts-nocheck
import Taro from '@tarojs/taro';

export type Product = Readonly<{ id: number; name: string; price: number; image: string; description?: string; stock?: number; specs?: readonly string[]; category?: string; status?: number }>;
export type ApiErrorCode = 'UNAUTHORIZED' | 'TIMEOUT' | 'NETWORK' | 'BUSINESS' | 'HTTP';
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | undefined;
  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message); this.name = 'ApiError'; this.code = code; this.status = status;
  }
}

const baseUrl = (process.env['TARO_API_BASE_URL'] ?? 'http://localhost/api').replace(/\/$/, '');
const tokenKey = 'crmeb_token';

export function setToken(token: string | null): void {
  if (token) Taro.setStorageSync(tokenKey, token); else Taro.removeStorageSync(tokenKey);
}
export function getToken(): string | null { return Taro.getStorageSync<string>(tokenKey) || null; }

export function clearToken(): void { setToken(null); }

export async function request<T>(path: string, options: Omit<Taro.request.Option<T>, 'url'> = {}): Promise<T> {
  const token = getToken();
  // CRMEB's API middleware expects the historical `Authori-zation` header.
  const header = { ...(options.header ?? {}), ...(token ? { 'Authori-zation': `Bearer ${token}` } : {}) };
  try {
    const response = await Taro.request<T>({ ...options, url: `${baseUrl}${path}`, header, timeout: options.timeout ?? 10000 });
    if (response.statusCode === 401) {
      clearToken();
      throw new ApiError('UNAUTHORIZED', '登录已过期', 401);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) throw new ApiError('HTTP', `请求失败（${response.statusCode}）`, response.statusCode);
    const body = response.data as T & { code?: number; msg?: string; status?: number };
    if (typeof body === 'object' && body !== null && typeof body.code === 'number' && body.code !== 0 && body.code !== 200) throw new ApiError('BUSINESS', body.msg ?? '业务请求失败');
    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = String(error);
    throw new ApiError(message.toLowerCase().includes('timeout') ? 'TIMEOUT' : 'NETWORK', '网络请求失败');
  }
}

export async function getProducts(): Promise<readonly Product[]> {
  return queryProducts({});
}

export type ProductQuery = Readonly<{ keyword?: string; category?: string; ids?: readonly number[]; limit?: number }>;

type ProductPayload = Readonly<{ data?: unknown; list?: unknown }>;

/** Normalizes the API's legacy list/data envelopes into the app product model. */
export function parseProducts(payload: ProductPayload, limit = 50): readonly Product[] {
  const data = payload.data;
  const candidates = Array.isArray(data) ? data : data && typeof data === 'object' && 'list' in data && Array.isArray(data.list)
    ? data.list : data && typeof data === 'object' ? [data] : Array.isArray(payload.list) ? payload.list : [];
  return candidates.flatMap((item): Product[] => {
    if (typeof item !== 'object' || item === null) return [];
    const record = item as Record<string, unknown>;
    const id = typeof record['id'] === 'number' ? record['id'] : Number(record['id']);
    const name = typeof record['name'] === 'string' ? record['name'] : record['store_name'];
    const image = typeof record['image'] === 'string' ? record['image'] : record['image_input'];
    const price = typeof record['price'] === 'number' ? record['price'] : Number(record['price']);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof name !== 'string' || !name.trim() || typeof image !== 'string' || !image || !Number.isFinite(price)) return [];
    return [{ id, name, price, image } satisfies Product];
  }).slice(0, limit);
}

export async function queryProducts(query: ProductQuery): Promise<readonly Product[]> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 50);
  const params = [`limit=${limit}`];
  if (query.keyword) params.push(`keyword=${encodeURIComponent(query.keyword)}`);
  if (query.category && query.category !== '全部') params.push(`category=${encodeURIComponent(query.category)}`);
  if (query.ids?.length) params.push(`ids=${encodeURIComponent(query.ids.join(','))}`);
  const payload = await request<ProductPayload>(`/products?${params.join('&')}`, { method: 'GET' });
  return parseProducts(payload, limit);
}

export async function getProduct(id: number): Promise<Product> {
  const payload = await request<ProductPayload>(`/product/detail/${encodeURIComponent(String(id))}`, { method: 'GET' });
  const product = parseProducts(payload, 1)[0];
  if (!product) throw new ApiError('BUSINESS', '商品不存在');
  return product;
}

export type OrderStatus = 'pending' | 'unpaid' | 'paid' | 'shipping' | 'completed' | 'cancelled' | 'refunding' | 'refunded';
export type OrderItem = Readonly<{ id: number; name: string; image?: string; price: number; quantity: number }>;
export type Order = Readonly<{ id: string; status: OrderStatus; statusText?: string; total: number; items: readonly OrderItem[]; createdAt?: string; address?: Readonly<{ name: string; phone: string; detail: string }> }>;
export type PaymentParams = Readonly<{ orderId: string; method: 'wechat' | 'alipay' | 'balance' }>;

function dataOf<T>(payload: T | Readonly<{ data?: T }>): T {
  if (typeof payload === 'object' && payload !== null && 'data' in payload) return (payload as { data?: T }).data as T;
  return payload as T;
}

export type ActivityOrder = Readonly<{ kind: string; id: number; productId?: number }>;
export type Fulfillment = Readonly<{ type: 'delivery' | 'pickup'; storeId?: number; address?: Order['address'] }>;
export async function createOrder(items: readonly OrderItem[], address?: Order['address'], activity?: ActivityOrder, fulfillment?: Fulfillment): Promise<Order> {
  const payload = await request<Order | { data: Order }>('/orders', { method: 'POST', data: { items, address: fulfillment?.address ?? address, activity, activity_type: activity?.kind, activity_id: activity?.id, product_id: activity?.productId, shipping_type: fulfillment?.type === 'pickup' ? 2 : 1, store_id: fulfillment?.storeId } });
  return dataOf(payload);
}
export async function getOrders(status?: OrderStatus): Promise<readonly Order[]> {
  const payload = await request<readonly Order[] | { data: readonly Order[] }>(`/orders${status ? `?status=${encodeURIComponent(status)}` : ''}`, { method: 'GET' });
  return dataOf(payload) ?? [];
}
export async function getOrder(orderId: string): Promise<Order> {
  const payload = await request<Order | { data: Order }>(`/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
  return dataOf(payload);
}
export async function cancelOrder(orderId: string): Promise<void> { await request(`/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' }); }
export async function requestPayment(params: PaymentParams): Promise<Readonly<{ paymentId?: string; payParams?: Record<string, unknown> }>> {
  const payload = await request<Readonly<{ data?: Readonly<{ paymentId?: string; payParams?: Record<string, unknown> }> }>>('/payments', { method: 'POST', data: params });
  return payload.data ?? {};
}
export async function queryPayment(orderId: string): Promise<Readonly<{ status: 'pending' | 'paid' | 'failed' | 'cancelled' }>> {
  const payload = await request<Readonly<{ data?: Readonly<{ status: 'pending' | 'paid' | 'failed' | 'cancelled' }> }>>(`/payments/${encodeURIComponent(orderId)}/status`, { method: 'GET' });
  return payload.data ?? { status: 'pending' };
}
export async function getLogistics(orderId: string): Promise<readonly Readonly<{ time: string; description: string }>[] > {
  const payload = await request<Readonly<{ data?: readonly Readonly<{ time: string; description: string }>[] }>>(`/orders/${encodeURIComponent(orderId)}/logistics`, { method: 'GET' });
  return payload.data ?? [];
}
export async function requestRefund(orderId: string, reason: string): Promise<void> { await request(`/orders/${encodeURIComponent(orderId)}/refund`, { method: 'POST', data: { reason } }); }
