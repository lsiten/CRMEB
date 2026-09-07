import { ApiError } from './api';

export type ApiRecord = Readonly<Record<string, unknown>>;
export const apiRecord = (value: unknown): ApiRecord => typeof value === 'object' && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {};
export const apiText = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
export function apiAmount(value: unknown): number {
  const number = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(number) || number < 0) throw new ApiError('BUSINESS', '金额数据不完整，请重试');
  return number;
}
export function apiId(value: unknown): string {
  const id = apiText(value);
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) throw new ApiError('BUSINESS', '业务标识无效，请重试');
  return id;
}
export function apiItems(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new ApiError('BUSINESS', '商品数据不完整，请重试');
  return value;
}
export function commerceError(error: unknown): string {
  return error instanceof ApiError ? error.message : '操作失败，请稍后重试';
}
