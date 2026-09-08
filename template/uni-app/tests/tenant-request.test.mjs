import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function harness(responses, settings = {}) {
  const calls = [];
  const storage = new Map([['tenantEntry', 'store-a']]);
  const state = { app: { token: 'user-a', sessionRevision: 0 } };
  const app = { globalData: { spid: 10, pid: 10, code: 'old', agent_id: 10 } };
  let logins = 0;
  const context = vm.createContext({ console, setTimeout, getApp: () => app, uni: {
    reLaunch: () => undefined, getStorageSync: key => storage.get(key), setStorageSync: (key,value) => storage.set(key,value),
    clearStorageSync: () => storage.clear(), uploadFile: options => { uploads.push(options); queueMicrotask(() => options.success(settings.uploadRaw ?? { statusCode: 200, data: '{"status":200}' })); }, showModal: () => {},
    request: options => { calls.push(options);
      if (settings.onRequest) { settings.onRequest(options); }
      else if (settings.base) {
        fetch(options.url, { method: options.method.toUpperCase(), headers: options.header,
          ...(options.method.toUpperCase() === 'POST' ? { body: JSON.stringify(options.data) } : {}) })
          .then(async response => options.success({ statusCode: response.status, data: await response.json() })).catch(options.fail);
      } else queueMicrotask(() => { const next = responses.shift(); options.success({ statusCode: 200, data: typeof next === 'function' ? next() : next }); });
    },
  } });
  const uploads = [];
  const cache = new Map();
  const fixtures = {
    config: { HTTP_REQUEST_URL: settings.base || 'http://localhost', TENANT_ENTRY: settings.entry ?? 'store-a', HEADER: {}, TOKENNAME: 'Authori-zation', TIMEOUT: 1000 },
    store: { default: { state, commit: name => { if (name === 'LOGOUT') state.app.token = false; } } },
    login: { checkLogin: () => true, toLogin: () => { logins++; } },
    lang: { default: { t: text => text } },
  };
  async function load(name) {
    if (cache.has(name)) return cache.get(name);
    let module;
    if (fixtures[name]) {
      const values = fixtures[name];
      module = new vm.SyntheticModule(Object.keys(values), function () { for (const [key,value] of Object.entries(values)) this.setExport(key,value); }, { context });
    } else {
      module = new vm.SourceTextModule(await readFile(new URL(`../utils/${name}`, import.meta.url), 'utf8'), { context });
    }
    cache.set(name,module);
    await module.link(specifier => load(specifier.includes('config/app') ? 'config' : specifier.includes('store') ? 'store'
      : specifier.includes('libs/login') ? 'login' : specifier.includes('lang') ? 'lang'
      : specifier.endsWith('tenant-session.mjs') ? 'tenant-session.mjs' : 'tenant.js'));
    return module;
  }
  const module = await load('request.js'); await module.evaluate();
  const upload = await load('tenant-upload.js'); await upload.evaluate();
  return { request: module.namespace.default, calls, uploads, logins: () => logins, state, storage, app, upload: upload.namespace.uploadWithTenant, tenant: cache.get('tenant.js').namespace };
}
const boot = token => ({ status: 200, data: { tenant: { id: 1,name: 'A',code: 'a' },tenant_token: token,expires_in: 3600 } });
const invalid = { status: 401,data: { code: 'tenant_token_invalid' } };
test('anonymous bootstrap followed by tenant and user headers', async () => {
  const h = await harness([boot('tenant-a'), { status: 200 }]);
  await h.request.get('user');
  assert.deepEqual(Object.keys(h.calls[0].header), ['content-type']);
  assert.equal(h.calls[1].header['X-Tenant-Token'], 'tenant-a');
  assert.equal(h.calls[1].header['Authori-zation'], 'Bearer user-a');
});
test('tenant 401 retries GET once, never invokes user login', async () => {
  const h = await harness([boot('old'),invalid,boot('new'),invalid]);
  await assert.rejects(h.request.get('products'), { code: 'TENANT_UNAVAILABLE' });
  assert.equal(h.calls.length,4); assert.equal(h.logins(),0);
});
test('POST is not replayed after tenant rejection', async () => {
  const h = await harness([boot('old'),invalid,boot('new')]);
  await assert.rejects(h.request.post('order/create'), { code: 'TENANT_UNAVAILABLE' });
  assert.equal(h.calls.length,3);
});
test('user 401 goes to login without tenant renewal', async () => {
  const h = await harness([boot('old'), { status: 401 }]);
  await assert.rejects(h.request.get('user'));
  assert.equal(h.calls.length,2); assert.equal(h.logins(),1);
});

test('return to default mode clears previous tenant credentials', async () => {
  const h = await harness([{ status: 200 }], { entry: '' });
  await h.request.get('products');
  assert.equal(h.state.app.token, false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].header['Authori-zation'], undefined);
});
test('real HTTP A/B cold starts and user401 distinction', { skip: !process.env.TENANT_HTTP_BASE }, async () => {
  const h = await harness([], { base: process.env.TENANT_HTTP_BASE.replace(/\/api$/, '') });
  h.state.app.token = false;
  const a = await h.request.get('__test/items', {}, { noAuth: true });
  assert.equal(a.data.tenant_id, 1);
  await assert.rejects(h.request.get('__test/user', {}, { noAuth: true }));
  assert.equal(h.logins(), 1);
  h.tenant.tenantSession.select('store-b');
  const b = await h.request.get('__test/items', {}, { noAuth: true });
  assert.equal(b.data.tenant_id, 2);
});
test('real reset renews token without replaying unknown business reads', { skip: !process.env.TENANT_HTTP_BASE || !process.env.TENANT_TEST_PORT }, async () => {
  const h = await harness([], { base: process.env.TENANT_HTTP_BASE.replace(/\/api$/, '') });
  h.state.app.token = false;
  await h.request.get('__test/items', {}, { noAuth: true });
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.env.TENANT_TEST_PHP, [new URL('./reset-isolated-tenant.php', import.meta.url).pathname], { env: process.env });
  await assert.rejects(h.request.get('__test/items', {}, { noAuth: true }), { code: 'TENANT_UNAVAILABLE' });
  const fresh = await h.request.get('__test/items', {}, { noAuth: true });
  assert.equal(fresh.data.tenant_id, 1);
  assert.equal(h.calls.filter(call => call.url.endsWith('/tenant/bootstrap')).length, 2);
  assert.equal(h.logins(), 0);
});

test('switch clears app referral identity and old user context', async () => {
  const h = await harness([]);
  h.tenant.tenantSession.select('store-b');
  assert.equal(h.app.globalData.spid, 0);
  assert.equal(h.app.globalData.code, 0);
  assert.equal(h.app.globalData.agent_id, 0);
  assert.equal(h.state.app.token, false);
});

test('same-token new session during renewal cannot replay old GET', async () => {
  const h = await harness([boot('old'), invalid, () => { h.state.app.sessionRevision++; return boot('fresh'); }]);
  await assert.rejects(h.request.get('products'), { code: 'TENANT_CHANGED' });
  assert.equal(h.calls.length, 3);
});
test('upload preserves non-JSON HTTP403 for original callback', async () => {
  const h = await harness([boot('tenant')], { uploadRaw: { statusCode: 403, data: 'denied' } });
  const response = await new Promise((resolve,reject) => h.upload({ success: resolve, fail: reject }));
  assert.equal(response.statusCode, 403);
  assert.equal(response.data, 'denied');
});

test('switch before first request persists the actual selected entry', async () => {
  const h = await harness([boot('tenant-b')]);
  await h.tenant.switchTenant('store-b');
  assert.equal(h.storage.get('tenantEntry'), 'store-b');
  assert.equal(h.calls[0].data.entry, 'store-b');
});

for (const operation of ['post', 'upload']) {
  test(`${operation} waiting for bootstrap cannot send with a newer user session`, async () => {
    const h = await harness([], { onRequest: options => {
      if (!options.url.endsWith('/tenant/bootstrap')) options.success({ statusCode: 200, data: { status: 200 } });
    } });
    const pending = operation === 'post' ? h.request.post('order/create')
      : new Promise((resolve, reject) => h.upload({ filePath: '/a.png', success: resolve, fail: reject }));
    const rejected = assert.rejects(pending, { code: 'TENANT_CHANGED' });
    h.state.app.token = 'user-b';
    h.state.app.sessionRevision++;
    h.calls[0].success({ statusCode: 200, data: boot('tenant-a') });
    await rejected;
    assert.equal(h.calls.length, 1, 'only bootstrap may reach request');
    assert.equal(h.uploads.length, 0, 'stale file must never reach uploadFile');
  });

  test(`${operation} after resolved ensure cannot send across a tenant switch`, async () => {
    const h = await harness([boot('tenant-a'), { status: 200 }]);
    await h.tenant.ensureTenant();
    const before = h.calls.length;
    const pending = operation === 'post' ? h.request.post('order/create', {}, { noAuth: true })
      : new Promise((resolve, reject) => h.upload({ filePath: '/a.png', success: resolve, fail: reject }));
    const rejected = assert.rejects(pending, { code: 'TENANT_CHANGED' });
    h.tenant.tenantSession.select('store-b');
    await rejected;
    assert.equal(h.calls.length, before, 'switch must block the old POST before transport');
    assert.equal(h.uploads.length, 0, 'switch must block the old upload before transport');
  });
}

test('same-session renewal preserves user and sends one allowed GET replay', async () => {
  const h = await harness([boot('old'), invalid, boot('fresh'), { status: 200 }]);
  await h.request.get('products');
  assert.equal(h.calls.length, 4);
  assert.equal(h.calls[3].header['X-Tenant-Token'], 'fresh');
  assert.equal(h.calls[3].header['Authori-zation'], 'Bearer user-a');
  assert.equal(h.state.app.sessionRevision, 0);
});

test('switch after renewal resolves blocks GET replay before transport', async () => {
  const h = await harness([boot('old'), invalid, boot('fresh'), { status: 200 }]);
  const renew = h.tenant.tenantSession.renew;
  h.tenant.tenantSession.renew = snapshot => renew(snapshot).then(result => {
    h.tenant.tenantSession.select('store-b');
    return result;
  });
  await assert.rejects(h.request.get('products'), { code: 'TENANT_CHANGED' });
  assert.equal(h.calls.filter(call => call.url.endsWith('/products')).length, 1);
});

test('same-token new login during bootstrap cannot send an old POST', async () => {
  const h = await harness([() => { h.state.app.sessionRevision++; return boot('tenant'); }, { status: 200 }]);
  await assert.rejects(h.request.post('user/edit'), { code: 'TENANT_CHANGED' });
  assert.equal(h.calls.length, 1);
});
