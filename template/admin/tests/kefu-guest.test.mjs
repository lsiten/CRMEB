import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const axios = require('axios');
async function fixture() {
  const calls = [];
  const pending = [];
  const context = vm.createContext({ Promise, Set, Object, Error, FormData });
  const fakeAxios = { create(options) {
    const client = axios.create(options);
    client.defaults.adapter = (config) => new Promise((resolve, reject) => {
      calls.push(config);
      pending.push({ resolve: (data) => resolve({ data, config }), reject });
    });
    return client;
  } };
  const cache = new Map();
  async function load(name) {
    if (cache.has(name)) return cache.get(name);
    const source = await readFile(new URL(`../src/libs/${name}.js`, import.meta.url), 'utf8');
    const mod = new vm.SourceTextModule(source, { context });
    cache.set(name, mod);
    await mod.link(async (specifier) => {
      if (specifier === 'axios' || specifier === '@/setting') {
        const value = specifier === 'axios' ? fakeAxios : { apiBaseURL: '/adminapi' };
        return new vm.SyntheticModule(['default'], function () { this.setExport('default', value); }, { context });
      }
      return load(specifier.split('/').pop().replace(/\.js$/, ''));
    });
    return mod;
  }
  const mod = await load('kefu-guest-request');
  await mod.evaluate();
  const session = cache.get('kefu-guest-session').namespace;
  return { api: mod.namespace, session, calls, pending };
}
const fake = (suffix = 'a') => ({ appid: `test-${suffix}`, screct_id: `fake-secret-${suffix}` });
const tick = () => new Promise((resolve) => setImmediate(resolve));
const code = (value) => (error) => error.data.code === value;

test('missing credentials block ordinary requests and uploads', async () => {
  const f = await fixture();
  await assert.rejects(f.api.default({ url: 'tourist/adv' }), code('tenant_auth_required'));
  await assert.rejects(f.api.uploadGuestFile({ file: new Blob(['x']), data: {} }), code('tenant_auth_required'));
  assert.equal(f.calls.length, 0);
});

test('only visitor allowlist receives headers; no staff/admin bearer', async () => {
  const f = await fixture();
  f.session.injectTenantCredentials(fake());
  for (const url of ['upload', '/login', 'service/list', 'https://example.com/tourist/adv', 'tourist/../upload']) {
    await assert.rejects(f.api.default({ url }), code('guest_endpoint_invalid'));
  }
  const result = f.api.default({ url: 'tourist/adv' });
  await tick();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].headers.appid, fake().appid);
  assert.equal(f.calls[0].headers.screct_id, fake().screct_id);
  assert.equal(f.calls[0].headers['Authori-zation'], undefined);
  f.pending[0].resolve({ status: 200, data: { content: 'A' } });
  assert.equal((await result).data.content, 'A');
});

test('current invalid blocks requests/uploads until explicit injection', async () => {
  const f = await fixture();
  f.session.injectTenantCredentials(fake());
  const result = f.api.default({ url: 'tourist/adv' });
  await tick();
  f.pending[0].resolve({ status: 401, data: { code: 'tenant_credentials_invalid' } });
  await assert.rejects(result, code('tenant_credentials_invalid'));
  await assert.rejects(f.api.default({ url: 'tourist/adv' }), code('tenant_auth_required'));
  await assert.rejects(f.api.uploadGuestFile({ file: new Blob(['x']) }), code('tenant_auth_required'));
  assert.equal(f.calls.length, 1);
  f.session.injectTenantCredentials(fake('b'));
  const fresh = f.api.default({ url: 'tourist/adv' });
  await tick();
  f.pending[1].resolve({ status: 200 });
  assert.equal((await fresh).status, 200);
});

for (const status of [200, 401, 503]) {
  test(`late ${status} cannot affect new generation`, async () => {
    const f = await fixture();
    f.session.injectTenantCredentials(fake());
    const old = f.api.default({ url: 'tourist/adv' });
    await tick();
    f.session.injectTenantCredentials(fake('b'));
    f.pending[0].resolve({ status, data: { code: 'tenant_credentials_invalid' } });
    await assert.rejects(old, code('guest_session_changed'));
    const fresh = f.api.default({ url: 'tourist/adv' });
    await tick();
    assert.equal(f.calls[1].headers.appid, fake('b').appid);
    f.pending[1].resolve({ status: 200 });
    await fresh;
  });
}

test('clear before dispatch is zero packets; late clear response is rejected', async () => {
  const f = await fixture();
  f.session.injectTenantCredentials(fake());
  const queued = f.api.default({ url: 'tourist/adv' });
  f.session.clearTenantCredentials();
  await assert.rejects(queued);
  assert.equal(f.calls.length, 0);
  f.session.injectTenantCredentials(fake());
  const pending = f.api.default({ url: 'tourist/chat' });
  await tick();
  f.session.clearTenantCredentials();
  f.pending[0].resolve({ status: 200 });
  await assert.rejects(pending, code('guest_session_changed'));
});

test('503 and user401 do not invalidate or expose raw Axios config', async () => {
  const f = await fixture();
  f.session.injectTenantCredentials(fake());
  for (const status of [503, 401]) {
    const promise = f.api.default({ url: 'tourist/adv' });
    await tick();
    f.pending.at(-1).reject({ config: f.calls.at(-1), response: { status, data: {
      status, msg: 'request failed', data: status === 503 ? { code: 'tenant_auth_unavailable' } : {},
    } } });
    await assert.rejects(promise, (error) => error.status === status && !JSON.stringify(error).includes(fake().screct_id));
  }
  assert.equal(f.calls.length, 2);
});

test('upload preserves filename and fields; queued selection cannot switch tenant', async () => {
  const f = await fixture();
  const file = new File(['image'], '相册照片.PNG', { type: 'image/png' });
  f.session.injectTenantCredentials(fake());
  f.api.prepareGuestUpload(file);
  f.session.injectTenantCredentials(fake('b'));
  await assert.rejects(f.api.uploadGuestFile({ file }), code('guest_session_changed'));
  assert.equal(f.calls.length, 0);
  f.api.prepareGuestUpload(file);
  const upload = f.api.uploadGuestFile({ file, data: { token: 'user-token', appid: 'untrusted' } });
  await tick();
  const form = f.calls[0].data;
  assert.deepEqual([...form.keys()].sort(), ['file', 'token']);
  assert.equal(form.get('file').name, file.name);
  assert.equal(form.get('file').type, file.type);
  assert.equal(await form.get('file').text(), 'image');
  assert.equal(form.get('token'), 'user-token');
  assert.equal(form.has('appid'), false);
  assert.equal(f.calls[0].headers.appid, fake('b').appid);
  assert.equal(f.calls[0].headers.screct_id, fake('b').screct_id);
  assert.equal(f.calls[0].headers['Authori-zation'], undefined);
  f.pending[0].resolve({ status: 200, data: { url: '/pixel.png' } });
  assert.equal((await upload).data.url, '/pixel.png');
});

test('invalid upload blocks ordinary calls and old upload error cannot clear replacement', async () => {
  const f = await fixture();
  const file = new File(['image'], 'test.png');
  f.session.injectTenantCredentials(fake());
  const old = f.api.uploadGuestFile({ file });
  await tick();
  f.session.injectTenantCredentials(fake('b'));
  f.pending[0].resolve({ status: 401, data: { code: 'tenant_credentials_invalid' } });
  await assert.rejects(old, code('guest_session_changed'));
  const current = f.api.uploadGuestFile({ file });
  await tick();
  f.pending[1].reject({ response: { status: 401, data: { status: 401, data: { code: 'tenant_credentials_invalid' } } } });
  await assert.rejects(current, code('tenant_credentials_invalid'));
  await assert.rejects(f.api.default({ url: 'tourist/adv' }), code('tenant_auth_required'));
  assert.equal(f.calls.length, 2);
});
