import Taro from '@tarojs/taro';

export type Product = Readonly<{ id: number; name: string; price: number; image: string; stock: number; maxQuantity: number }>;
export type User = Readonly<{ uid: number; nickname: string; avatar: string }>;
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
  const header = { ...(options.header ?? {}), ...(token ? { 'Authori-zation': `Bearer ${token}` } : {}) };
  try {
    const response = await Taro.request<T>({ ...options, url: `${baseUrl}${path}`, header, timeout: options.timeout ?? 10000 });
    if (response.statusCode === 401) { setToken(null); throw new ApiError('UNAUTHORIZED', '登录已过期', 401); }
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
  const payload = await request<Readonly<{ data?: readonly Record<string, unknown>[] }>>('/products', { method: 'GET' });
  if (!Array.isArray(payload.data)) return [];
  return payload.data.flatMap((item) => {
    const id = typeof item.id === 'number' ? item.id : Number(item.id);
    const price = typeof item.price === 'number' ? item.price : Number(item.price ?? item.priceStr);
    const stock = Math.max(0, Number(item.stock ?? item.stock_num ?? 0));
    const name = typeof item.name === 'string' ? item.name : typeof item.store_name === 'string' ? item.store_name : '';
    const image = typeof item.image === 'string' ? item.image : '';
    if (!Number.isFinite(id) || !name || !Number.isFinite(price)) return [];
    return [{ id, name, price, image, stock, maxQuantity: stock > 0 ? Math.min(stock, 99) : 99 }];
  });
}

export async function login(): Promise<User> {
  const loginResult = await Taro.login();
  if (!loginResult.code) throw new ApiError('BUSINESS', '微信登录未获取 code');
  const authType = await request<Readonly<{ data?: Readonly<{ key?: string; bindPhone?: boolean }> }>>('/v2/routine/auth_type', {
    method: 'GET',
    data: { code: loginResult.code },
  });
  const key = authType.data?.key;
  if (!key) throw new ApiError('BUSINESS', '登录凭证无效');
  if (authType.data?.bindPhone) throw new ApiError('BUSINESS', '请先绑定手机号');
  const authLogin = await request<Readonly<{ data?: Readonly<{ token?: string }> }>>('/v2/routine/auth_login', {
    method: 'GET',
    data: { key },
  });
  const token = authLogin.data?.token;
  if (!token) throw new ApiError('BUSINESS', '登录响应缺少 token');
  setToken(token);
  return getUser();
}

export async function getUser(): Promise<User> {
  const payload = await request<Readonly<{ data?: Record<string, unknown> }>>('/userinfo', { method: 'GET' });
  const data = payload.data ?? {};
  return { uid: Number(data['uid'] ?? data['id'] ?? 0), nickname: String(data['nickname'] ?? data['real_name'] ?? '会员'), avatar: String(data['avatar'] ?? '') };
}
