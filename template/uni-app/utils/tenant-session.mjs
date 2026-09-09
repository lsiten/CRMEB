export class TenantError extends Error {
  constructor(code) {
    super(code === 'TENANT_CHANGED' ? '商城或账号已切换，请重新操作' : '商城认证不可用，请联系接入方');
    this.name = 'TenantError';
    this.code = code;
  }
}
const tenantCodes = new Set(['tenant_auth_required', 'tenant_credentials_invalid', 'tenant_auth_unavailable',
  'tenant_mismatch', 'tenant_bootstrap_unavailable', 'tenant_token_invalid']);
export function isTenantInvalid(body) {
  return body !== null && typeof body === 'object' && tenantCodes.has(body.data?.code);
}
export function tenantResponseError(body) {
  return new TenantError(isTenantInvalid(body) ? body.data.code : 'tenant_auth_unavailable');
}
export function createTenantSession({ clear: clearState = () => {} } = {}) {
  let revision = 0;
  let credentials;
  function assertCurrent(snapshot) {
    if (snapshot.revision !== revision) throw new TenantError('TENANT_CHANGED');
  }
  function clear() {
    revision++;
    credentials = undefined;
    clearState();
  }
  function inject(value) {
    clear();
    if (!value || typeof value !== 'object' || !['appid', 'screct_id'].every(key =>
      typeof value[key] === 'string' && /^[A-Za-z0-9_-]{1,256}$/.test(value[key]))) {
      throw new TenantError('tenant_credentials_invalid');
    }
    credentials = { appid: value.appid, screct_id: value.screct_id };
  }
  function snapshot() {
    if (!credentials) throw new TenantError('tenant_auth_required');
    return { revision };
  }
  function headers(snapshot, extra = {}) {
    assertCurrent(snapshot);
    if (!credentials) throw new TenantError('tenant_auth_required');
    const safe = Object.fromEntries(Object.entries(extra).filter(([key, value]) => typeof value === 'string' &&
      !['appid', 'screct_id', 'screct-id', 'x-tenant-token', 'authorization', 'authori-zation'].includes(key.toLowerCase())));
    return { ...safe, ...credentials };
  }
  return { snapshot, ensure: async () => snapshot(), inject, clear, headers, assertCurrent, enabled: () => true, revision: () => revision };
}
