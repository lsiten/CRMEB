import { HTTP_REQUEST_URL, TENANT_ENTRY } from '../config/app';
import store from '../store';
import { createTenantSession, isTenantInvalid, TenantError } from './tenant-session.mjs';

const listeners = new Set();
export function subscribeTenant(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function clearTenantState() {
  for (const listener of listeners) listener();
  const app = typeof getApp === 'function' ? getApp() : undefined;
  if (app && app.globalData) Object.assign(app.globalData, { spid: 0, pid: 0, code: 0, agent_id: 0, isLogin: false, userInfo: {}, MyMenus: [] });
  const locale = uni.getStorageSync('locale');
  uni.clearStorageSync();
  if (locale) uni.setStorageSync('locale', locale);
  store.commit('LOGOUT');
  store.commit('UPDATE_USERINFO', {});
  store.commit('FOOT_UPLOAD', {});
  store.commit('hotWords/setHotWord', []);
  store.commit('indexData/setIndexData', {});
  store.commit('indexData/setCartNum', 0);
}
let initialized = false;
export const tenantSession = createTenantSession({
  entry: TENANT_ENTRY,
  clear: clearTenantState,
  bootstrap: entry => new Promise((resolve, reject) => {
    uni.request({ url: HTTP_REQUEST_URL + '/api/tenant/bootstrap', method: 'POST',
      data: { entry }, header: { 'content-type': 'application/json' }, timeout: 10000,
      success: response => response.statusCode === 200 ? resolve(response.data) : reject(new TenantError('TENANT_UNAVAILABLE')),
      fail: reject });
  })
});
export function initializeTenantState() {
  if (!initialized) {
    initialized = true;
    if ((uni.getStorageSync('tenantEntry') || '') !== TENANT_ENTRY) {
      clearTenantState();
      uni.setStorageSync('tenantEntry', TENANT_ENTRY);
    }
  }
}
export function ensureTenant() {
  initializeTenantState();
  return tenantSession.ensure();
}
export async function switchTenant(entry) {
  tenantSession.select(entry);
  uni.setStorageSync('tenantEntry', entry);
  uni.reLaunch({ url: '/pages/index/index' });
  await ensureTenant();
}
export { isTenantInvalid, TenantError };
