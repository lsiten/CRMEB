import { getCookies, getSessionRevision, removeCookies } from '@/libs/util';
import { clearTenantContext } from '@/utils/tenant';
import store from '@/store';

export function captureSession(kefu = false) {
  const key = kefu ? 'kefu_token' : 'token';
  return { key, token: getCookies(key), revision: getSessionRevision(key) };
}

export function isCurrentSession(session) {
  return !!session && session.token === getCookies(session.key) && session.revision === getSessionRevision(session.key);
}

export function sessionChangedError() {
  return { code: 'SESSION_CHANGED', msg: '登录会话已变更，请重试' };
}

export function clearSession(session) {
  if (!isCurrentSession(session)) return false;
  const keys = session.key === 'kefu_token'
    ? ['kefu_token', 'kefu_expires_time', 'kefu_uuid', 'kefuInfo']
    : ['token', 'expires_time', 'uuid'];
  keys.forEach(removeCookies);
  if (session.key === 'token') {
    clearTenantContext();
    store.commit('resetAdminSession');
  }
  return true;
}
