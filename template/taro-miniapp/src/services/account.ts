import Taro from '@tarojs/taro';
import { ApiError, request, setToken } from './api';

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

export async function loginByWechat(): Promise<UserProfile | null> {
  if (process.env['TARO_ENV'] === 'h5') {
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
  const payload = await request<ApiEnvelope<UserProfile>>('/v1/userinfo', { method: 'GET' });
  return payload.data ?? null;
}

export async function bindWechatPhone(detail: Readonly<{ code?: string; encryptedData?: string; iv?: string }>): Promise<void> {
  if (process.env['TARO_ENV'] === 'h5') {
    throw new ApiError('BUSINESS', 'H5 暂不支持微信手机号绑定');
  }
  const login = await Taro.login();
  await request('/v2/routine/auth_binding_phone', {
    method: 'POST', data: { code: detail.code ?? login.code, iv: detail.iv ?? '', encryptedData: detail.encryptedData ?? '' },
  });
}

export async function getAddresses(): Promise<readonly Address[]> {
  const payload = await request<ApiEnvelope<readonly Address[]>>('/v1/address/list', { method: 'GET' });
  return Array.isArray(payload.data) ? payload.data : [];
}

export async function saveAddress(address: AddressDraft): Promise<void> {
  await request('/v1/address/edit', {
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
}

export async function setDefaultAddress(id: number): Promise<void> {
  await request('/v1/address/default/set', { method: 'POST', data: { id } });
}

export async function deleteAddress(id: number): Promise<void> {
  await request('/v1/address/del', { method: 'POST', data: { id } });
}
