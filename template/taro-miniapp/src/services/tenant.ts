import Taro from '@tarojs/taro';
import { createTenantSession, isTenantInvalid, TenantError } from './tenant-session.mjs';

const entryKey = 'crmeb.tenantEntry';
const configuredEntry = process.env.TARO_TENANT_ENTRY ?? '';
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
  const marker: unknown = Taro.getStorageSync(entryKey);
  const previousEntry = marker && typeof marker === 'object' && 'entry' in marker && typeof marker.entry === 'string' ? marker.entry : '';
  if (previousEntry !== configuredEntry) {
    clearTenantStorage();
    Taro.setStorageSync(entryKey, { entry: configuredEntry });
  }
}
export const tenantSession = createTenantSession({
  entry: configuredEntry,
  clear: clearTenantStorage,
  bootstrap: async (entry) => {
    const response = await Taro.request<unknown>({
      url: `${(process.env.TARO_API_BASE_URL ?? 'http://127.0.0.1:8080/api').replace(/\/$/, '')}/tenant/bootstrap`,
      method: 'POST', data: { entry }, header: { 'content-type': 'application/json' }, timeout: 10000,
    });
    if (response.statusCode !== 200) throw new TenantError('TENANT_UNAVAILABLE');
    return response.data;
  },
});
export function subscribeTenant(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export async function switchTenant(entry: string): Promise<void> {
  initializeTenantState();
  tenantSession.select(entry);
  Taro.setStorageSync(entryKey, { entry });
  await Taro.reLaunch({ url: '/pages/index/index' });
  await tenantSession.ensure();
}
export { isTenantInvalid, TenantError };
