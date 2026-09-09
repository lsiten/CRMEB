import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTenantSession } from '../src/services/tenant-session.mjs';
const result = (token) => ({ status: 200, data: { tenant: { id: 1, name: 'A', code: 'a' }, tenant_token: token, expires_in: 3600 } });
test('cold starts share one anonymous bootstrap', async () => {
  let calls = 0;
  const session = createTenantSession({ entry: 'a', bootstrap: async (entry) => { assert.equal(entry, 'a'); calls++; return result('one'); } });
  const tokens = await Promise.all([session.ensure(), session.ensure()]);
  assert.deepEqual(tokens.map(x => x.token), ['one', 'one']);
  assert.equal(calls, 1);
});
test('concurrent invalid responses renew once and late old invalid does not evict new token', async () => {
  let calls = 0;
  const session = createTenantSession({ entry: 'a', bootstrap: async () => result(String(++calls)) });
  const old = await session.ensure();
  const fresh = await Promise.all([session.renew(old), session.renew(old)]);
  assert.deepEqual(fresh.map(x => x.token), ['2', '2']);
  assert.equal((await session.renew(old)).token, '2');
  assert.equal(calls, 2);
});
test('switch rejects late bootstrap and clears state before next entry', async () => {
  let finish;
  let cleared = 0;
  const session = createTenantSession({ entry: 'a', clear: () => cleared++, bootstrap: () => new Promise(resolve => { finish = resolve; }) });
  const pending = session.ensure();
  session.select('b');
  finish(result('old'));
  await assert.rejects(pending, { code: 'TENANT_CHANGED' });
  assert.equal(cleared, 1);
});
test('failed bootstrap stops requests without default tenant fallback', async () => {
  const session = createTenantSession({ entry: 'a', bootstrap: async () => ({ status: 503 }) });
  await assert.rejects(session.ensure(), { code: 'TENANT_UNAVAILABLE' });
});
test('expiry uses one renewal and old request epoch cannot validate after switch', async () => {
  let now = 0;
  let calls = 0;
  const session = createTenantSession({ entry: 'a', now: () => now, bootstrap: async () => result(String(++calls)) });
  const old = await session.ensure();
  now = 3600000;
  assert.equal((await session.ensure()).token, '2');
  session.select('b');
  assert.throws(() => session.assertCurrent(old), { code: 'TENANT_CHANGED' });
});
test('GET mutations are never considered safe tenant replay', async () => {
  const { canReplayTenantRead } = await import('../src/services/tenant-session.mjs');
  for (const path of ['user_cancel', 'order/refund/del/1', 'wechat/auth', '/user_cancel']) assert.equal(canReplayTenantRead(path, 'GET'), false);
  assert.equal(canReplayTenantRead('products?limit=10','GET'), true);
});
