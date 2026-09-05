import Taro from '@tarojs/taro';

export type Product = Readonly<{
  id: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  stock?: number;
  specs?: readonly string[];
}>;
export type ApiErrorCode = 'UNAUTHORIZED' | 'TIMEOUT' | 'NETWORK' | 'BUSINESS' | 'HTTP';
export type LoginResult = Readonly<{ token: string; expires_time?: number; bindName?: boolean }>;
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
  const payload = await request<Readonly<{ data?: readonly Product[] }>>('/products', { method: 'GET' });
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function loginWithWechat(): Promise<LoginResult> {
  const login = await Taro.login();
  if (!login.code) throw new ApiError('BUSINESS', '无法获取微信登录凭证');
  const authType = await request<Readonly<{ data?: Readonly<{ key?: string; bindPhone?: boolean }> }>>(
    `/v2/routine/auth_type?code=${encodeURIComponent(login.code)}`,
    { method: 'GET' },
  );
  const key = authType.data?.key;
  if (!key) throw new ApiError('BUSINESS', authType.data?.bindPhone ? '请先绑定手机号' : '登录凭证无效');
  const authLogin = await request<Readonly<{ data?: LoginResult }>>(
    `/v2/routine/auth_login?key=${encodeURIComponent(key)}`,
    { method: 'GET' },
  );
  const result = authLogin.data;
  if (!result?.token) throw new ApiError('BUSINESS', '登录失败，请稍后重试');
  setToken(result.token);
  return result;
}
