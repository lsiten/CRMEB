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
    clearStorageSync: () => storage.clear(), uploadFile: options => { uploads.push(options); if (settings.onUpload) settings.onUpload(options); else queueMicrotask(() => options.success(settings.uploadRaw ?? { statusCode: 200, data: '{"status":200}' })); }, showModal: () => {},
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
    login: { checkLogin: () => Boolean(state.app.token), toLogin: () => { logins++; } },
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
  const tenant = cache.get('tenant.js').namespace;
  tenant.initializeTenantState();
  if (!settings.missing) tenant.injectTenantCredentials({ appid: 'fake-a', screct_id: 'fake-secret-a' });
  state.app.token = 'user-a';
  return { request: module.namespace.default, calls, uploads, logins: () => logins, state, storage, app, upload: upload.namespace.uploadWithTenant, tenant: cache.get('tenant.js').namespace };
}
test('missing credentials block request and upload', async () => {
  const h = await harness([], { missing: true });
  await assert.rejects(h.request.get('products'), { code: 'tenant_auth_required' });
  let failure;
  await h.upload({ fail: error => { failure = error; } });
  assert.equal(failure.code, 'tenant_auth_required');
  assert.equal(h.calls.length + h.uploads.length, 0);
});
test('request and upload attach credentials only as headers', async () => {
  const h = await harness([{ status: 200 }]);
  await h.request.post('order/create', { amount: 12 });
  await h.upload({ header: { APPID: 'override', 'X-Tenant-Token': 'old' } });
  for (const call of [...h.calls, ...h.uploads]) {
    assert.equal(call.header.appid, 'fake-a'); assert.equal(call.header.screct_id, 'fake-secret-a');
    assert.equal(call.header['Authori-zation'], 'Bearer user-a');
    assert.equal(call.header.APPID, undefined); assert.equal(call.header['X-Tenant-Token'], undefined);
  }
  assert.deepEqual(h.calls[0].data, { amount: 12 });
});
for (const code of ['tenant_auth_required','tenant_auth_unavailable','tenant_mismatch','tenant_bootstrap_unavailable','tenant_token_invalid']) {
  test(code + ' does not login or replay POST/upload', async () => {
    const body = { status: code === 'tenant_auth_unavailable' ? 503 : 401, data: { code } };
    const h = await harness([body], { uploadRaw: { statusCode: body.status, data: JSON.stringify(body) } });
    await assert.rejects(h.request.post('order/create'), { code });
    let failure;
    await new Promise(resolve => h.upload({ fail: error => { failure = error; resolve(); } }));
    assert.equal(failure.code, code); assert.equal(h.logins(), 0);
    assert.equal(h.calls.length, 1); assert.equal(h.uploads.length, 1);
  });
}
for (const source of ['request', 'upload']) {
  test(source + ' invalidates current tenant when only user changes in flight', async () => {
    let finish;
    const callback = options => { finish = options.success; };
    const h = await harness([], source === 'request' ? { onRequest: callback } : { onUpload: callback });
    const pending = source === 'request' ? h.request.get('products') : new Promise((resolve, reject) => h.upload({ success: resolve, fail: reject }));
    await Promise.resolve(); await Promise.resolve();
    h.state.app.token = 'new-user'; h.state.app.sessionRevision++;
    const body = { status: 401, data: { code: 'tenant_credentials_invalid' } };
    finish({ statusCode: 200, data: source === 'request' ? body : JSON.stringify(body) });
    await assert.rejects(pending, { code: 'tenant_credentials_invalid' });
    await assert.rejects(h.request.get('products'), { code: 'tenant_auth_required' });
    assert.equal(h.calls.length + h.uploads.length, 1); assert.equal(h.logins(), 0);
  });
  test(source + ' invalid credentials stop subsequent request/upload and reinjection recovers', async () => {
    const body = { status: 401, data: { code: 'tenant_credentials_invalid' } };
    const h = await harness([body], { uploadRaw: { statusCode: 200, data: JSON.stringify(body) } });
    const upload = () => new Promise((resolve, reject) => h.upload({ success: resolve, fail: reject }));
    await assert.rejects(source === 'request' ? h.request.post('order/create') : upload(), { code: 'tenant_credentials_invalid' });
    await assert.rejects(h.request.get('products'), { code: 'tenant_auth_required' });
    await assert.rejects(upload(), { code: 'tenant_auth_required' });
    assert.equal(h.calls.length + h.uploads.length, 1);
    assert.equal(h.logins(), 0);
    h.tenant.injectTenantCredentials({ appid: 'fake-a', screct_id: 'new-secret' });
    assert.equal(h.tenant.tenantSession.headers(h.tenant.tenantSession.snapshot()).screct_id, 'new-secret');
  });
  for (const replacement of ['same', 'reset', 'switch']) {
    test(source + ' late invalid error cannot clear ' + replacement + ' generation', async () => {
      let finish;
      const callback = options => { finish = options.success; };
      const h = await harness([], source === 'request' ? { onRequest: callback } : { onUpload: callback });
      const pending = source === 'request' ? h.request.get('products') : new Promise((resolve, reject) => h.upload({ success: resolve, fail: reject }));
      await Promise.resolve(); await Promise.resolve();
      const next = { appid: replacement === 'switch' ? 'fake-b' : 'fake-a', screct_id: replacement === 'same' ? 'fake-secret-a' : 'new-secret' };
      h.tenant.injectTenantCredentials(next); h.state.app.token = 'new-user';
      const body = { status: 401, data: { code: 'tenant_credentials_invalid' } };
      finish({ statusCode: 200, data: source === 'request' ? body : JSON.stringify(body) });
      await assert.rejects(pending, { code: 'TENANT_CHANGED' });
      assert.equal(h.tenant.tenantSession.headers(h.tenant.tenantSession.snapshot()).screct_id, next.screct_id);
      assert.equal(h.state.app.token, 'new-user'); assert.equal(h.logins(), 0);
    });
  }
}
test('user401 alone invokes login', async () => {
  const h = await harness([{ status: 401 }]);
  await assert.rejects(h.request.get('user')); assert.equal(h.logins(), 1);
});
for (const kind of ['tenant', 'account']) {
  test(kind + ' change rejects late success', async () => {
    let finish;
    const h = await harness([], { onRequest: options => { finish = options.success; } });
    const pending = h.request.get('products');
    await Promise.resolve(); await Promise.resolve();
    if (kind === 'tenant') h.tenant.injectTenantCredentials({ appid: 'fake-b', screct_id: 'fake-secret-b' });
    else h.state.app.sessionRevision++;
    finish({ statusCode: 200, data: { status: 200 } });
    await assert.rejects(pending, { code: 'TENANT_CHANGED' });
  });
  test(kind + ' change during await sends nothing', async () => {
    const h = await harness([]);
    const pending = h.request.post('order/create');
    if (kind === 'tenant') h.tenant.clearTenantCredentials(); else h.state.app.sessionRevision++;
    await assert.rejects(pending, { code: 'TENANT_CHANGED' });
    assert.equal(h.calls.length, 0);
  });
}
test('injection clears cached tenant and user state without persisting credentials', async () => {
  const h = await harness([]); h.storage.set('cart', [1]);
  h.tenant.injectTenantCredentials({ appid: 'fake-b', screct_id: 'fake-secret-b' });
  assert.equal(h.state.app.token, false); assert.equal(h.storage.size, 0);
  assert.equal(h.app.globalData.spid, 0);
});
test('H5 get_script uses guarded noAuth/noVerify request', async () => {
  const h = await harness([], { missing: true });
  await assert.rejects(h.request.get('get_script', {}, { noAuth: true, noVerify: true }), { code: 'tenant_auth_required' });
  assert.equal(h.calls.length, 0);
});
