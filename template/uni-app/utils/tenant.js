import store from '../store';
import { createTenantSession, isTenantInvalid, tenantResponseError, TenantError } from './tenant-session.mjs';

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
export const tenantSession = createTenantSession({ clear: clearTenantState });
export function initializeTenantState() {
  if (initialized) return;
  initialized = true;
  clearTenantState();
}
export function injectTenantCredentials(credentials) {
  initializeTenantState();
  tenantSession.inject(credentials);
}
export function clearTenantCredentials() { tenantSession.clear(); }
export function ensureTenant() {
  initializeTenantState();
  return tenantSession.ensure();
}
export async function switchTenant(credentials) {
  injectTenantCredentials(credentials);
  await uni.reLaunch({ url: '/pages/index/index' });
}
export { isTenantInvalid, tenantResponseError, TenantError };
