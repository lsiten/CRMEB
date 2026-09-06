import { request } from './api';

export type AssetSummary = Readonly<{ balance: number; integral: number; commission: number; frozenCommission: number }>;
export type AssetRecord = Readonly<{ id: string; type: string; amount: number; remark: string; createdAt?: string }>;
export type Coupon = Readonly<{ id: number; title: string; amount: number; minPrice: number; status: string; expireAt?: string }>;
export type PromotionInfo = Readonly<{ enabled: boolean; uid?: number; commission: number; peopleCount: number; qrcode?: string; poster?: string }>;

type Envelope<T> = Readonly<{ data?: T; list?: T }>;
const imageCdn = (process.env.TARO_IMAGE_CDN || process.env.TARO_IMAGE_HOST || '').replace(/\/$/, '');

/** Rewrites relative/absolute assets to the configured CDN without changing query parameters. */
export function resolveImageUrl(value: string | undefined): string {
  if (!value) return '';
  if (!imageCdn || /^(?:https?:|data:|blob:|\/\/)/i.test(value)) return value;
  return `${imageCdn}/${value.replace(/^\/+/, '')}`;
}

const unwrap = <T>(value: T | Envelope<T>): T => typeof value === 'object' && value !== null && 'data' in value ? (value.data as T) : value as T;
const num = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0) || 0;

export async function getAssetSummary(): Promise<AssetSummary> {
  const value = unwrap(await request<unknown | Envelope<unknown>>('/user/center', { method: 'GET' }));
  const row = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  return { balance: num(row['now_money'] ?? row['balance']), integral: num(row['integral']), commission: num(row['commissionCount'] ?? row['commission']), frozenCommission: num(row['broken_commission'] ?? row['frozenCommission']) };
}

export async function getAssetRecords(type = ''): Promise<readonly AssetRecord[]> {
  const value = unwrap(await request<unknown | Envelope<unknown>>(`/user/bill${type ? `?type=${encodeURIComponent(type)}` : ''}`, { method: 'GET' }));
  const rows = Array.isArray(value) ? value : [];
  return rows.flatMap((item, index) => { if (typeof item !== 'object' || item === null) return []; const row = item as Record<string, unknown>; const createdAt = typeof row['add_time'] === 'string' ? row['add_time'] : undefined; return [{ id: String(row['id'] ?? index), type: String(row['type'] ?? ''), amount: num(row['number'] ?? row['amount']), remark: String(row['title'] ?? row['mark'] ?? '资产变动'), ...(createdAt ? { createdAt } : {}) }]; });
}

export async function getCoupons(): Promise<readonly Coupon[]> {
  const value = unwrap(await request<unknown | Envelope<unknown>>('/coupons/user/0', { method: 'GET' }));
  const rows = Array.isArray(value) ? value : [];
  return rows.flatMap((item) => { if (typeof item !== 'object' || item === null) return []; const row = item as Record<string, unknown>; const id = num(row['id']); const expireAt = typeof row['end_time'] === 'string' ? row['end_time'] : undefined; return id ? [{ id, title: String(row['coupon_title'] ?? row['title'] ?? '优惠券'), amount: num(row['coupon_price'] ?? row['amount']), minPrice: num(row['use_min_price'] ?? row['minPrice']), status: String(row['status'] ?? '可使用'), ...(expireAt ? { expireAt } : {}) }] : []; });
}

export async function getPromotionInfo(): Promise<PromotionInfo> {
  const value = unwrap(await request<unknown | Envelope<unknown>>('/user/spread_info', { method: 'GET' }));
  const row = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const uid = num(row['uid']); const qrcode = typeof row['qrcode'] === 'string' ? row['qrcode'] : undefined; const poster = typeof row['poster'] === 'string' ? row['poster'] : undefined;
  return { enabled: Boolean(row['spread_status'] ?? true), ...(uid ? { uid } : {}), commission: num(row['commissionCount']), peopleCount: num(row['spread_count'] ?? row['peopleCount']), ...(qrcode ? { qrcode } : {}), ...(poster ? { poster } : {}) };
}
