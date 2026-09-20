let credentials = null;
let revision = 0;
const listeners = new Set();

export function guestError(code, msg, status = 401) {
  return { status, msg, data: { code } };
}

function changed() {
  revision += 1;
  listeners.forEach((listener) => listener());
}

export function clearTenantCredentials() {
  credentials = null;
  changed();
}

export function injectTenantCredentials(value) {
  if (
    !value ||
    !['appid', 'screct_id'].every((key) => typeof value[key] === 'string' && /^[\x21-\x7e]{1,256}$/.test(value[key]))
  ) {
    clearTenantCredentials();
    throw guestError('tenant_credentials_invalid', '客服访问凭据格式错误');
  }
  credentials = { appid: value.appid, screct_id: value.screct_id };
  changed();
}

export function guestSnapshot() {
  if (!credentials) throw guestError('tenant_auth_required', '客服访问尚未就绪，请联系接入方');
  return revision;
}

export function assertGuestSnapshot(snapshot) {
  if (snapshot !== revision) throw guestError('guest_session_changed', '客服访问已切换，请重新操作');
  guestSnapshot();
}

export function guestHeaders(snapshot) {
  assertGuestSnapshot(snapshot);
  return { ...credentials };
}

export function invalidateGuestSnapshot(snapshot) {
  if (snapshot === revision) clearTenantCredentials();
}

export function onGuestCredentialsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
