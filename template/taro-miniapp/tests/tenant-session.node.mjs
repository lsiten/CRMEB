import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTenantSession, isTenantInvalid } from '../src/services/tenant-session.mjs';

test('missing credentials reject without invoking a transport', async () => {
  let calls = 0;
  const session = createTenantSession({ bootstrap: () => { calls++; } });
  await assert.rejects(session.ensure(), { code: 'tenant_auth_required' });
  assert.equal(calls, 0);
});
test('injection replaces memory credentials and invalidates old snapshots', async () => {
  let clears = 0;
  const session = createTenantSession({ clear: () => clears++ });
  session.inject({ appid: 'isolated-a', screct_id: 'fake-a' });
  const first = await session.ensure();
  assert.deepEqual(session.headers(first), { appid: 'isolated-a', screct_id: 'fake-a' });
  session.inject({ appid: 'isolated-b', screct_id: 'fake-b' });
  assert.throws(() => session.headers(first), { code: 'TENANT_CHANGED' });
  session.clear();
  await assert.rejects(session.ensure(), { code: 'tenant_auth_required' });
  assert.equal(clears, 3);
});
for (const code of ['tenant_auth_required', 'tenant_credentials_invalid', 'tenant_auth_unavailable', 'tenant_mismatch', 'tenant_bootstrap_unavailable', 'tenant_token_invalid']) {
  test(`routes ${code} independently from user auth`, () => {
    assert.equal(isTenantInvalid({ status: 401, data: { code } }), true);
    assert.equal(isTenantInvalid({ status: 401 }), false);
  });
}
