import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const axios = require('axios');
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function fixture() {
  const cookies = { token: 'admin-a', kefu_token: 'staff-a' };
  const revisions = { token: 0, kefu_token: 0 };
  const effects = [], pending = [];
  const util = {
    getCookies: (key) => cookies[key], getSessionRevision: (key) => revisions[key], setTitle() {},
    removeCookies(key) { delete cookies[key]; if (key in revisions) revisions[key]++; },
    setCookies(key, value) { cookies[key] = value; if (key in revisions) revisions[key]++; },
  };
  const store = { state: { userInfo: { uniqueAuth: [] } }, commit: (...args) => effects.push(['commit', ...args]) };
  let guard, client;
  class Router {
    beforeEach(fn) { guard = fn; }
    afterEach() {}
    replace(value) { effects.push(['replace', value]); return Promise.resolve(); }
    push() { return Promise.resolve(); }
  }
  const router = new Router();
  const context = vm.createContext({ console, Promise, setTimeout,
    localStorage: { clear: () => effects.push('global-clear') } });
  const mocks = {
    axios: { default: { defaults: {}, create(options) {
      client = axios.create(options);
      client.defaults.adapter = (config) => new Promise((resolve, reject) => pending.push({ config,
        resolve: (data) => resolve({ config, data }), reject: (status) => reject({ config, response: { status } }) }));
      return client;
    } } },
    vue: { default: { use() {}, prototype: { bus: { $emit: (...args) => effects.push(['event', ...args]) } } } },
    'vue-router': { default: Router }, './routers': { default: [] },
    '@/libs/util': util, '@/store': { default: store }, '@/router': { default: router },
    '@/utils/tenant': { clearTenantContext: () => effects.push('tenant-clear') },
    '@/libs/auth': { includeArray: () => true }, '@/utils/loading.js': { PrevLoading: { done() {} } },
    '@/libs/system': { formatFlatteningRoutes: (value) => value },
    '@/setting': { default: { apiBaseURL: '/adminapi' } },
    'element-ui': { Message: { error: () => effects.push('message') } },
  };
  const cache = new Map();
  function load(path) {
    if (cache.has(path)) return cache.get(path);
    const mod = new vm.SourceTextModule(readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8'), { context });
    cache.set(path, mod);
    return mod;
  }
  const mod = load('router/index.js');
  await mod.link((name) => {
      if (!mocks[name]) return load(`${name.replace('@/', '')}.js`);
      const values = mocks[name];
      return new vm.SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context });
    });
  await mod.evaluate();
  return { cookies, effects, pending, util, get client() { return client; }, async start() {
    await guard({ fullPath: '/home', name: 'home', matched: [{ meta: { auth: true } }], meta: { auth: [] } }, {},
      (value) => effects.push(['next', value]));
    await tick(); effects.length = 0;
    assert.equal(pending[0].config.headers['Authori-zation'], 'Bearer admin-a');
  } };
}
const success = { status: 200, data: { uniqueAuth: ['home'], menus: [{ path: '/home' }] } };
for (const outcome of ['success', 401, 402, 419, 'http401', 'http500']) {
  test(`real requester → menus → guard: late ${outcome} preserves replacement session and state`, async () => {
    const f = await fixture(); await f.start(); f.util.setCookies('token', 'admin-b');
    if (String(outcome).startsWith('http')) f.pending[0].reject(Number(outcome.slice(4)));
    else f.pending[0].resolve(outcome === 'success' ? success : { status: outcome });
    await tick();
    assert.equal(f.cookies.token, 'admin-b'); assert.equal(f.cookies.kefu_token, 'staff-a');
    assert.deepEqual(f.effects, [['next', false]]);
  });
}
for (const outcome of ['success', 'failure']) {
  test(`session changes after interceptor ${outcome}: consumer has no stale side effects`, async () => {
    const f = await fixture(); await f.start();
    f.client.interceptors.response.use((value) => { f.util.setCookies('token', 'admin-b'); return value; },
      (error) => { f.util.setCookies('token', 'admin-b'); return Promise.reject(error); });
    // Axios captures its interceptor chain at request time; start another request with the new hook.
    f.pending[0].resolve(success); await tick(); f.effects.length = 0;
    await f.start();
    if (outcome === 'success') f.pending[1].resolve(success); else f.pending[1].reject(500);
    await tick();
    assert.equal(f.cookies.token, 'admin-b'); assert.equal(f.cookies.kefu_token, 'staff-a');
    assert.ok(!f.effects.some((e) => e === 'global-clear' || e === 'tenant-clear' || e[0] === 'commit' || e[0] === 'event'));
    assert.deepEqual(f.effects.filter((e) => Array.isArray(e) && e[0] === 'next'), [['next', false]]);
  });
}
for (const changeStaff of [false, true]) {
  test(`current menu success restores permissions (staff changed=${changeStaff})`, async () => {
    const f = await fixture(); await f.start();
    if (changeStaff) f.util.setCookies('kefu_token', 'staff-b');
    f.pending[0].resolve(success); await tick();
    assert.equal(f.cookies.token, 'admin-a');
    assert.ok(f.effects.some((e) => e[0] === 'commit' && e[1] === 'userInfo/uniqueAuth'));
    assert.deepEqual(f.effects.filter((e) => e[0] === 'next'), [['next', undefined]]);
    assert.ok(!f.effects.includes('global-clear'));
  });
}
test('current menu business failure expires only admin without global storage clearing', async () => {
  const f = await fixture(); await f.start(); f.pending[0].resolve({ status: 400 }); await tick();
  assert.equal(f.cookies.token, undefined); assert.equal(f.cookies.kefu_token, 'staff-a');
  assert.ok(!f.effects.includes('global-clear'));
  assert.equal(f.effects.find((e) => e[0] === 'next')[1].name, 'login');
});
