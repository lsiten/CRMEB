import Taro from '@tarojs/taro';

export type Product = Readonly<{ id: number; name: string; price: number; image: string; category?: string; stock?: number; status?: number }>;
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

export async function request<T>(path: string, options: Omit<Taro.request.Option<T>, 'url'> = {}): Promise<T> {
  const token = getToken();
  const header = { ...(options.header ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  try {
    const response = await Taro.request<T>({ ...options, url: `${baseUrl}${path}`, header, timeout: options.timeout ?? 10000 });
    if (response.statusCode === 401) throw new ApiError('UNAUTHORIZED', '登录已过期', 401);
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

function parseProducts(payload: ProductPayload, limit: number): readonly Product[] {
  const data = payload.data;
  const candidates = Array.isArray(data) ? data : data && typeof data === 'object' && 'list' in data && Array.isArray(data.list)
    ? data.list : Array.isArray(payload.list) ? payload.list : [];
  return candidates.filter((item): item is Product => {
    if (typeof item !== 'object' || item === null) return false;
    const record = item as Record<string, unknown>;
    return typeof record['id'] === 'number' && typeof record['name'] === 'string' && typeof record['price'] === 'number' && typeof record['image'] === 'string';
  }).slice(0, limit);
}

export async function queryProducts(query: ProductQuery): Promise<readonly Product[]> {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 50);
  const params = new URLSearchParams();
  if (query.keyword) params.set('keyword', query.keyword);
  if (query.category && query.category !== '全部') params.set('category', query.category);
  if (query.ids?.length) params.set('ids', query.ids.join(','));
  params.set('limit', String(limit));
  const payload = await request<ProductPayload>(`/products?${params.toString()}`, { method: 'GET' });
  return parseProducts(payload, limit);
}

export async function getProduct(id: number): Promise<Product> {
  const payload = await request<Readonly<{ data?: Product }>>(`/products/${encodeURIComponent(String(id))}`, { method: 'GET' });
  if (!payload.data) throw new ApiError('BUSINESS', '商品不存在');
  return payload.data;
}
