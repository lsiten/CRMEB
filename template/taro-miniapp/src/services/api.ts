import Taro from '@tarojs/taro';
import { track } from './telemetry';

export type ProductVariant = Readonly<{ unique: string; label: string; price: number; stock: number; image?: string }>;
export type Product = Readonly<{ id: number; name: string; price: number; image: string; description?: string; stock?: number; specs?: readonly string[]; variants?: readonly ProductVariant[]; unique?: string; category?: string; status?: number; collected?: boolean }>;
export type ApiErrorCode = 'UNAUTHORIZED' | 'TIMEOUT' | 'NETWORK' | 'BUSINESS' | 'HTTP';
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number | undefined;
  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message); this.name = 'ApiError'; this.code = code; this.status = status;
  }
}

const baseUrl = (process.env.TARO_API_BASE_URL ?? 'http://127.0.0.1:8080/api').replace(/\/$/, '');
const tokenKey = 'crmeb_token';
let authRevision = 0;
const authListeners = new Set<() => void>();
export function getAuthRevision(): number { return authRevision; }
export function subscribeAuthSession(listener: () => void): () => void {
  authListeners.add(listener);
  return () => { authListeners.delete(listener); };
}
type AuthSession = Readonly<{ token: string | null; revision: number }>;
type AuthExpiry = Readonly<{ session: AuthSession; revision: number }>;
let authExpiry: AuthExpiry | undefined;
const expiredRequests = new WeakMap<ApiError, AuthExpiry>();

export function setToken(token: string | null): void {
  authRevision += 1;
  authExpiry = undefined;
  if (token) Taro.setStorageSync(tokenKey, token); else Taro.removeStorageSync(tokenKey);
  for (const listener of authListeners) listener();
}
export function getToken(): string | null { return Taro.getStorageSync<string>(tokenKey) || null; }

export function clearToken(): void { setToken(null); }

export function captureAuthSession(): AuthSession { return { token: getToken(), revision: authRevision }; }
export function isCurrentAuthSession(session: AuthSession, cause?: unknown): boolean {
  if (session.revision === authRevision && session.token === getToken()) return true;
  const expired = cause instanceof ApiError ? expiredRequests.get(cause) : undefined;
  return expired !== undefined && expired.session.token === session.token && expired.session.revision === session.revision
    && expired.revision === authRevision && getToken() === null;
}

function expireAuthSession(session: AuthSession, message: string): ApiError {
  const error = new ApiError('UNAUTHORIZED', message, 401);
  if (session.token !== null && isCurrentAuthSession(session)) {
    clearToken();
    authExpiry = { session, revision: authRevision };
  }
  // Anonymous follow-up requests share the original expiry until explicit login/logout.
  if (authExpiry && ((authExpiry.session.token === session.token && authExpiry.session.revision === session.revision)
      || (session.token === null && session.revision === authExpiry.revision))
    && authExpiry.revision === authRevision && getToken() === null) {
    expiredRequests.set(error, authExpiry);
  }
  return error;
}

export async function request<T>(path: string, options: Omit<Taro.request.Option<T>, 'url'> = {}): Promise<T> {
  const startedAt = Date.now();
  const session = captureAuthSession();
  const token = session.token;
  // CRMEB's API middleware expects the historical `Authori-zation` header.
  const formType = process.env.TARO_ENV === 'h5' ? (typeof navigator !== 'undefined' && /micromessenger/i.test(navigator.userAgent) ? 'wechat' : 'h5') : 'routine';
  const header = { 'content-type': 'application/json', 'Form-type': formType, ...(options.header ?? {}), ...(token ? { 'Authori-zation': `Bearer ${token}` } : {}) };
  try {
    const response = await Taro.request<T>({ ...options, url: `${baseUrl}${path}`, header, timeout: options.timeout ?? 10000 });
    if (response.statusCode === 401) {
      track('api_error', { path, code: 'UNAUTHORIZED', status: 401, durationMs: Date.now() - startedAt });
      throw expireAuthSession(session, '登录已过期');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      track('api_error', { path, code: 'HTTP', status: response.statusCode, durationMs: Date.now() - startedAt });
      throw new ApiError('HTTP', `请求失败（${response.statusCode}）`, response.statusCode);
    }
    const body = response.data;
    if (typeof body === 'object' && body !== null && 'status' in body && typeof body.status === 'number') {
      const message = 'msg' in body && typeof body.msg === 'string' ? body.msg : '业务请求失败';
      if (body.status === 401) {
        track('api_error', { path, code: 'UNAUTHORIZED', status: 401, durationMs: Date.now() - startedAt });
        throw expireAuthSession(session, message);
      }
      if (body.status !== 200 && body.status !== 0) {
        track('api_error', { path, code: 'BUSINESS', status: body.status, durationMs: Date.now() - startedAt });
        throw new ApiError('BUSINESS', message, body.status);
      }
    }
    if (typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'number' && body.code !== 0 && body.code !== 200) {
      track('api_error', { path, code: 'BUSINESS', durationMs: Date.now() - startedAt });
      throw new ApiError('BUSINESS', 'msg' in body && typeof body.msg === 'string' ? body.msg : '业务请求失败');
    }
    return body;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const message = String(error);
    const code = message.toLowerCase().includes('timeout') ? 'TIMEOUT' : 'NETWORK';
    track('api_error', { path, code, durationMs: Date.now() - startedAt });
    throw new ApiError(code, '网络请求失败');
  }
}

export async function getProducts(): Promise<readonly Product[]> {
  return queryProducts({});
}

export type ProductQuery = Readonly<{ keyword?: string; category?: string; ids?: readonly number[]; limit?: number }>;

type ProductCacheEntry = Readonly<{ expiresAt: number; value: readonly Product[] }>;
// Builder-owned cache: bounded TTL avoids duplicate list requests during tab switches.
const productCache = new Map<string, ProductCacheEntry>();
const PRODUCT_CACHE_TTL_MS = 30_000;

type ProductPayload = Readonly<{ data?: unknown; list?: unknown }>;

/** Normalizes the API's legacy list/data envelopes into the app product model. */
export function parseProducts(payload: ProductPayload, limit = 50): readonly Product[] {
  const data = payload.data;
  const candidates = Array.isArray(data) ? data : data && typeof data === 'object' && 'list' in data && Array.isArray(data.list)
    ? data.list : data && typeof data === 'object' ? [data] : Array.isArray(payload.list) ? payload.list : [];
  return candidates.flatMap((item): Product[] => {
    if (typeof item !== 'object' || item === null) return [];
    const record: Readonly<Record<string, unknown>> = Object.fromEntries(Object.entries(item));
    const id = typeof record['id'] === 'number' ? record['id'] : Number(record['id']);
    const name = typeof record['name'] === 'string' ? record['name'] : record['store_name'];
    const image = typeof record['image'] === 'string' ? record['image'] : record['image_input'];
    const price = typeof record['price'] === 'number' ? record['price'] : Number(record['price']);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof name !== 'string' || !name.trim() || typeof image !== 'string' || !image || !Number.isFinite(price)) return [];
    const stock = Number(record['stock']);
    return [{ id, name, price, image, ...(record['stock'] !== undefined && record['stock'] !== null && Number.isSafeInteger(stock) && stock >= 0 ? { stock } : {}) } satisfies Product];
  }).slice(0, limit);
}

export async function queryProducts(query: ProductQuery): Promise<readonly Product[]> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 50);
  const cacheKey = JSON.stringify({ keyword: query.keyword ?? '', category: query.category ?? '', ids: query.ids ?? [], limit });
  const cached = productCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (cached) productCache.delete(cacheKey);
  const params = [`limit=${limit}`];
  if (query.keyword) params.push(`keyword=${encodeURIComponent(query.keyword)}`);
  if (query.category && query.category !== '全部') params.push(`category=${encodeURIComponent(query.category)}`);
  if (query.ids?.length) params.push(`ids=${encodeURIComponent(query.ids.join(','))}`);
  const payload = await request<ProductPayload>(`/products?${params.join('&')}`, { method: 'GET' });
  const value = parseProducts(payload, limit);
  productCache.set(cacheKey, { value, expiresAt: Date.now() + PRODUCT_CACHE_TTL_MS });
  return value;
}

export { getProduct } from './product-detail';

export type OrderStatus = 'pending' | 'unpaid' | 'paid' | 'shipping' | 'review' | 'completed' | 'cancelled' | 'refunding' | 'refunded';
export type OrderItem = Readonly<{ id: number; cartId?: string; reviewUnique?: string; reviewed?: boolean; spec?: string; name: string; image?: string; price: number; quantity: number }>;
export type Order = Readonly<{ id: string; internalId?: number; canRefund?: boolean; canBuyAgain?: boolean; canPay?: boolean; canCancel?: boolean; canReceive?: boolean; canDelete?: boolean; splitOrderIds?: readonly string[]; statusMessage?: string; deliveryType?: string; status: OrderStatus; statusText?: string; total: number; items: readonly OrderItem[]; createdAt?: string; address?: Readonly<{ name: string; phone: string; detail: string }> }>;
export type { PaymentParams } from './payment';

export type ActivityOrder = Readonly<{ kind: string; id: number; productId?: number }>;
export type Fulfillment = Readonly<{ type: 'delivery' | 'pickup'; storeId?: number; address?: Order['address'] }>;
export { createOrder } from './checkout';
export { getOrders, getOrder, cancelOrder, getLogistics } from './orders';
export { requestPayment, queryPayment } from './payment';
