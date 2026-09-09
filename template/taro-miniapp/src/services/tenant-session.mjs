export class TenantError extends Error {
  constructor(code) {
    super(code === 'TENANT_CHANGED' ? '商城已切换，请重新操作' : '商城暂不可用，请稍后重试');
    this.name = 'TenantError';
    this.code = code;
  }
}

export function isTenantInvalid(body) {
  return body !== null && typeof body === 'object' && body.status === 401
    && body.data?.code === 'tenant_token_invalid';
}

// Each application owns a separate instance; tokens stay in memory.
export function createTenantSession({ entry = '', bootstrap, clear = () => {}, now = Date.now }) {
  let revision = 0;
  let current;
  let pending;
  function assertCurrent(snapshot) {
    if (snapshot.revision !== revision) throw new TenantError('TENANT_CHANGED');
  }
  function select(next) {
    if (typeof next !== 'string' || !next.trim()) throw new TenantError('TENANT_UNAVAILABLE');
    if (entry === next) return;
    revision++;
    entry = next;
    current = undefined;
    pending = undefined;
    clear();
  }
  function ensure() {
    if (!entry) return Promise.resolve({ revision, token: '', expiresAt: Infinity });
    if (current && current.expiresAt > now() + 30000) return Promise.resolve(current);
    if (pending) return pending;
    const snapshot = { revision };
    const requestedEntry = entry;
    const operation = (async () => {
      const body = await bootstrap(requestedEntry);
      assertCurrent(snapshot);
      const data = body?.data;
      if (body?.status !== 200 || typeof data?.tenant_token !== 'string' || !data.tenant_token
        || !Number.isSafeInteger(data?.tenant?.id) || data.tenant.id <= 0
        || typeof data.tenant.name !== 'string' || typeof data.tenant.code !== 'string'
        || !Number.isFinite(data.expires_in) || data.expires_in <= 0) {
        throw new TenantError('TENANT_UNAVAILABLE');
      }
      current = { revision, token: data.tenant_token, expiresAt: now() + data.expires_in * 1000 };
      return current;
    })();
    pending = operation;
    return operation.finally(() => { if (pending === operation) pending = undefined; });
  }
  function renew(snapshot) {
    assertCurrent(snapshot);
    if (current?.token === snapshot.token) current = undefined;
    return ensure();
  }
  return { ensure, renew, select, assertCurrent, enabled: () => Boolean(entry), revision: () => revision };
}

// Legacy API also uses GET for mutations; method alone does not imply safety.
export function canReplayTenantRead(path, method = 'GET') {
  return method.toUpperCase() === 'GET' && ['products', 'user', 'version'].includes(path.replace(/^\//, '').split('?')[0]);
}
