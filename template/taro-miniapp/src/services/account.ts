import Taro from '@tarojs/taro';
import { request, setToken } from './api';

export type UserProfile = Readonly<{ uid: number; nickname: string; avatar: string; phone: string; integral: number }>;
export type Address = Readonly<{ id: number; real_name: string; phone: string; province: string; city: string; district: string; detail: string; is_default: boolean }>;

type ApiEnvelope<T> = Readonly<{ data?: T; token?: string; userInfo?: UserProfile }>;

export async function loginByWechat(): Promise<UserProfile | null> {
  const login = await Taro.login();
  const payload = await request<ApiEnvelope<Readonly<{ token?: string; userInfo?: UserProfile }>>>('/v1/wechat/mp_auth', {
    method: 'POST', data: { code: login.code, login_type: 'routine' },
  });
  const token = payload.data?.token ?? payload.token;
  if (token) setToken(token);
  return payload.data?.userInfo ?? payload.userInfo ?? null;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const payload = await request<ApiEnvelope<UserProfile>>('/v1/userinfo', { method: 'GET' });
  return payload.data ?? null;
}

export async function bindWechatPhone(detail: Readonly<{ code?: string; encryptedData?: string; iv?: string }>): Promise<void> {
  const login = await Taro.login();
  await request('/v2/routine/auth_binding_phone', {
    method: 'POST', data: { code: detail.code ?? login.code, iv: detail.iv ?? '', encryptedData: detail.encryptedData ?? '' },
  });
}

export async function getAddresses(): Promise<readonly Address[]> {
  const payload = await request<ApiEnvelope<readonly Address[]>>('/v1/address/list', { method: 'GET' });
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function setDefaultAddress(id: number): Promise<void> {
  await request('/v1/address/default/set', { method: 'POST', data: { id } });
}

export async function deleteAddress(id: number): Promise<void> {
  await request('/v1/address/del', { method: 'POST', data: { id } });
}
