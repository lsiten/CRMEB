import Taro from '@tarojs/taro';
import { createTenantSession, isTenantInvalid, tenantResponseError, TenantError } from './tenant-session.mjs';

const listeners = new Set<() => void>();
function clearTenantStorage(): void {
  for (const key of Taro.getStorageInfoSync().keys) {
    if (key.startsWith('crmeb') || key === 'guideDate') Taro.removeStorageSync(key);
  }
  for (const listener of listeners) listener();
}
let initialized = false;
export function initializeTenantState(): void {
  if (initialized) return;
  initialized = true;
  clearTenantStorage();
}
export const tenantSession = createTenantSession({ clear: clearTenantStorage });
export function injectTenantCredentials(credentials: unknown): void {
  initializeTenantState();
  tenantSession.inject(credentials);
}
export function clearTenantCredentials(): void { tenantSession.clear(); }
export function subscribeTenant(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function switchTenant(credentials: unknown): Promise<void> {
  injectTenantCredentials(credentials);
  await Taro.reLaunch({ url: '/pages/index/index' });
}
export { isTenantInvalid, tenantResponseError, TenantError };
