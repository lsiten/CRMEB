import Taro from '@tarojs/taro';
import { ApiError, clearToken, request, setToken } from './api';

export type UserProfile = Readonly<{ uid: number; nickname: string; avatar: string; phone: string; integral: number }>;
export type Address = Readonly<{ id: number; real_name: string; phone: string; province: string; city: string; district: string; detail: string; is_default: boolean }>;
export type AddressDraft = Readonly<{
  id?: number;
  real_name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  is_default: boolean;
}>;

type ApiEnvelope<T> = Readonly<{ data?: T; token?: string; userInfo?: UserProfile }>;

type LoginPayload = Readonly<{ token?: string; userInfo?: UserProfile; expires_time?: number }>;
export type Agreement = Readonly<{ title: string; content: string; name?: string; avatar?: string }>;

function persistLogin(payload: ApiEnvelope<LoginPayload>): void {
  const token = payload.data?.token ?? payload.token;
  if (!token) throw new ApiError('BUSINESS', '登录凭证无效');
  setToken(token);
}

export async function loginByPassword(account: string, password: string): Promise<UserProfile | null> {
  const payload = await request<ApiEnvelope<LoginPayload>>('/login', { method: 'POST', data: { account, password } });
  persistLogin(payload);
  return getUserProfile();
}

export async function loginBySms(phone: string, captcha: string): Promise<UserProfile | null> {
  const payload = await request<ApiEnvelope<LoginPayload>>('/login/mobile', { method: 'POST', data: { phone, captcha } });
  persistLogin(payload);
  return getUserProfile();
}

export async function registerUser(phone: string, captcha: string, password: string): Promise<void> {
  await request('/register', { method: 'POST', data: { account: phone, captcha, password } });
}

export async function requestSmsCode(phone: string, type: 'login' | 'register' | 'reset'): Promise<void> {
  const keyPayload = await request<ApiEnvelope<Readonly<{ key?: string }>>>('/verify_code', { method: 'GET' });
  const key = keyPayload.data?.key;
  if (!key) throw new ApiError('BUSINESS', '验证码服务暂不可用');
  await request('/register/verify', { method: 'POST', data: { phone, type, key } });
}

export async function resetPassword(phone: string, captcha: string, password: string): Promise<void> {
  await request('/register/reset', { method: 'POST', data: { account: phone, captcha, password } });
}

export async function loginByWechat(): Promise<UserProfile | null> {
  if (process.env.TARO_ENV === 'h5') {
    throw new ApiError('BUSINESS', 'H5 暂不支持微信登录，请使用服务端 H5 登录态');
  }
  const login = await Taro.login();
  const authType = await request<ApiEnvelope<Readonly<{ key?: string; bindPhone?: boolean }>>>('/v2/routine/auth_type', {
    method: 'GET', data: { code: login.code },
  });
  const key = authType.data?.key;
  if (!key) throw new ApiError('BUSINESS', '授权信息无效');
  const payload = await request<ApiEnvelope<Readonly<{ token?: string }>>>('/v2/routine/auth_login', {
    method: 'GET', data: { key },
  });
  const token = payload.data?.token ?? payload.token;
  if (token) setToken(token);
  return getUserProfile();
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const payload = await request<ApiEnvelope<UserProfile>>('/userinfo', { method: 'GET' });
  return payload.data ?? null;
}

export async function updateUserProfile(profile: Readonly<{ nickname: string; avatar: string }>): Promise<void> {
  await request('/user/edit', { method: 'POST', data: profile });
}

export async function bindUserPhone(phone: string, captcha: string, replace = false): Promise<void> {
  await request(replace ? '/user/updatePhone' : '/user/binding', { method: 'POST', data: { phone, captcha } });
}

export async function logout(): Promise<void> {
  try { await request('/logout', { method: 'GET' }); } finally { clearToken(); }
}

export async function getAgreement(type: 3 | 4 | 5): Promise<Agreement> {
  const payload = await request<ApiEnvelope<Agreement>>(`/get_agreement/${type}`, { method: 'GET' });
  const agreement = payload.data;
  if (!agreement || typeof agreement.title !== 'string' || typeof agreement.content !== 'string') {
    throw new ApiError('BUSINESS', '协议内容暂不可用');
  }
  return agreement;
}

export async function cancelAccount(): Promise<void> {
  await request('/user_cancel', { method: 'GET' });
  clearToken();
}

export async function bindWechatPhone(detail: Readonly<{ code?: string; encryptedData?: string; iv?: string }>): Promise<void> {
  if (process.env.TARO_ENV === 'h5') {
    throw new ApiError('BUSINESS', 'H5 暂不支持微信手机号绑定');
  }
  const login = await Taro.login();
  await request('/v2/routine/auth_binding_phone', {
    method: 'POST', data: { code: detail.code ?? login.code, iv: detail.iv ?? '', encryptedData: detail.encryptedData ?? '' },
  });
}

export async function getAddresses(): Promise<readonly Address[]> {
  const payload = await request<ApiEnvelope<readonly Address[]>>('/address/list', { method: 'GET' });
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function getAddress(id: number): Promise<Address> {
  const payload = await request<ApiEnvelope<Address>>(`/address/detail/${encodeURIComponent(String(id))}`, { method: 'GET' });
  if (!payload.data) throw new ApiError('BUSINESS', '地址不存在');
  return payload.data;
}

export async function saveAddress(address: AddressDraft): Promise<number | undefined> {
  const payload = await request<ApiEnvelope<Readonly<{ id?: number }>>>('/address/edit', {
    method: 'POST',
    data: {
      ...(address.id ? { id: address.id } : {}),
      real_name: address.real_name,
      phone: address.phone,
      detail: address.detail,
      is_default: address.is_default,
      type: 1,
      address: { province: address.province, city: address.city, district: address.district },
    },
  });
  return payload.data?.id ?? address.id;
}

export async function setDefaultAddress(id: number): Promise<void> {
  await request('/address/default/set', { method: 'POST', data: { id } });
}

export async function deleteAddress(id: number): Promise<void> {
  await request('/address/del', { method: 'POST', data: { id } });
}
