import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';
import path from 'node:path';

const require = createRequire(import.meta.url);
const Vue = require('vue'), Vuex = require('vuex');
Vue.use(Vuex);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const plain = (value) => JSON.parse(JSON.stringify(value));
function storage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key), clear() { throw new Error('global storage clearing is forbidden'); } };
}
async function fixture(local = storage(), session = storage()) {
  const cookies = { token: 'admin-a', kefu_token: 'staff-a', kefuInfo: 'staff-info' };
  const revisions = { token: 0, kefu_token: 0 }, pending = [], effects = [];
  const util = Object.fromEntries(['getBreadCrumbList', 'setTagNavListInLocalstorage', 'getTagNavListFromLocalstorage',
    'getHomeRoute', 'getNextRoute', 'routeHasExist', 'routeEqual', 'getRouteTitleHandled', 'localSave'].map((name) => [name, () => {}]));
  Object.assign(util, { localRead: (key) => local.getItem(key), getCookies: (key) => cookies[key],
    getSessionRevision: (key) => revisions[key],
    removeCookies(key) { delete cookies[key]; if (key in revisions) revisions[key]++; },
    setCookies(key, value) { cookies[key] = value; if (key in revisions) revisions[key]++; } });
  const context = vm.createContext({ console, require: (name) => name, window: { localStorage: local, sessionStorage: session },
    localStorage: local, sessionStorage: session, setTimeout });
  const mocks = {
    vue: { default: Vue }, vuex: { default: Vuex }, 'vuex-persist': { default: require('vuex-persist').default },
    lodash: require('lodash'), screenfull: { default: {} },
    '@/libs/util': util, '@/libs/system': { includeArray: () => true },
    '@/config': { default: { homeName: 'home' } }, '@/components/diyComponents/index.js': { default: {} },
    '@/libs/socket': { Socket: Promise.resolve({ send() {} }) },
    '@/router': { default: { replace: (value) => effects.push(value) } },
    '@/setting': { default: { apiBaseURL: '/adminapi' } },
    '@/api/user': {}, '@/api/order': { getOrdes() {} }, '@/api/marketing': { integralGetOrdes() {} },
    '@/api/kefu': { AccountLogoutKefu() {} },
    'element-ui': { Message: { error: () => effects.push('message') } },
    axios: { default: { defaults: {}, create(options) {
      const client = require('axios').create(options);
      client.defaults.adapter = (config) => new Promise((resolve, reject) => pending.push({
        resolve: (data) => resolve({ config, data }), reject: (status) => reject({ config, response: { status } }) }));
      return client;
    } } },
  };
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const mod = new vm.SourceTextModule(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), { context, identifier: file });
    cache.set(file, mod); return mod;
  }
  function mock(name, values) {
    const key = `mock:${name}`;
    if (!cache.has(key)) cache.set(key, new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context }));
    return cache.get(key);
  }
  function linker(name, parent) {
    if (mocks[name]) return mock(name, mocks[name]);
    let file = name.startsWith('@/') ? name.replace('@/', 'src/') : path.posix.join(path.posix.dirname(parent.identifier), name);
    if (file.endsWith('.json')) return mock(file, { default: JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url))) });
    if (file === 'src/store') file += '/index';
    if (!file.endsWith('.js')) file += '.js';
    return load(file);
  }
  const entry = new vm.SourceTextModule("export { default as store } from '@/store'; export { default as request } from '@/libs/request'; export { captureSession, clearSession } from '@/libs/auth-session';", { context });
  await entry.link(linker); await entry.evaluate();
  return { ...entry.namespace, local, session, cookies, util, pending, effects };
}
function seed(f) {
  f.store.commit('tenant/setContext', { current: { id: 7 }, list: [{ id: 7 }] });
  f.store.commit('userInfo/userInfo', { id: 7, tenant_id: 7 });
  f.store.commit('userInfo/uniqueAuth', ['old-permission']);
  f.store.commit('menus/getmenusNav', [{ path: '/old' }]);
  f.store.commit('routesList/getRoutesList', [{ path: '/old' }]);
  f.store.commit('kefu/setInfo', { id: 9, name: 'staff' });
  for (const key of ['TENANT_CURRENT', 'TENANT_LIST', 'PERMISSIONS']) f.local.setItem(`from-crmeb-admin:${key}`, JSON.stringify('old'));
  for (const key of ['menuList', 'tagNaveList', 'DELIVERY_DATA', 'ADMIN_TITLE']) f.local.setItem(key, JSON.stringify(['old']));
  f.local.setItem('unrelated', 'keep'); f.local.setItem('from-crmeb-admin:themeConfig', 'keep');
  f.session.setItem('from-crmeb-admin:userInfo', 'old'); f.session.setItem('wsLogin', 'keep');
}
function assertCleared(f) {
  assert.equal(f.cookies.token, undefined); assert.equal(f.cookies.kefu_token, 'staff-a');
  assert.equal(f.cookies.kefuInfo, 'staff-info');
  for (const state of [plain(f.store.state), JSON.parse(f.local.getItem('vuex'))]) {
    assert.equal(state.tenant.current, null); assert.deepEqual(state.tenant.list, []);
    assert.equal(state.userInfo.userInfo, null); assert.deepEqual(state.userInfo.uniqueAuth, []);
    assert.deepEqual(state.menus.menusName, []); assert.deepEqual(state.routesList.routesList, []);
    assert.deepEqual(state.kefu.kefuInfo, { id: 9, name: 'staff' });
  }
  for (const key of ['TENANT_CURRENT', 'TENANT_LIST', 'PERMISSIONS']) assert.equal(f.local.getItem(`from-crmeb-admin:${key}`), null);
  for (const key of ['menuList', 'tagNaveList', 'DELIVERY_DATA', 'ADMIN_TITLE']) assert.equal(f.local.getItem(key), null);
  assert.equal(f.session.getItem('from-crmeb-admin:userInfo'), null);
  assert.equal(f.local.getItem('unrelated'), 'keep'); assert.equal(f.local.getItem('from-crmeb-admin:themeConfig'), 'keep');
  assert.equal(f.session.getItem('wsLogin'), 'keep');
}
for (const outcome of [401, 402, 419, 'http401', 'logout']) {
  test(`actual Vuex/persist: admin ${outcome} clears admin memory and persistence, retaining staff`, async () => {
    const f = await fixture(); seed(f);
    if (outcome === 'logout') assert.equal(f.clearSession(f.captureSession()), true);
    else {
      const reply = f.request({ url: '/info' }); await tick();
      if (outcome === 'http401') f.pending[0].reject(401); else f.pending[0].resolve({ status: outcome });
      await assert.rejects(reply);
    }
    assertCleared(f);
    f.store.commit('kefu/setInfo', { id: 9, name: 'staff' }); assertCleared(f);
    const reloaded = await fixture(f.local, f.session);
    assert.equal(reloaded.store.state.tenant.current, null);
    assert.deepEqual(plain(reloaded.store.state.userInfo.uniqueAuth), []);
    assert.deepEqual(plain(reloaded.store.state.kefu.kefuInfo), { id: 9, name: 'staff' });
  });
}
test('late admin invalidation does not reset new admin Vuex or persistence', async () => {
  const f = await fixture(); seed(f);
  const before = f.local.getItem('vuex'); const reply = f.request({ url: '/info' }); await tick();
  f.util.setCookies('token', 'admin-b'); f.pending[0].resolve({ status: 419 });
  await assert.rejects(reply, (error) => error.code === 'SESSION_CHANGED');
  assert.equal(f.local.getItem('vuex'), before); assert.equal(f.store.state.tenant.current.id, 7);
});
test('defaults captured at startup cannot restore stored tenant or menus after repeated clearing', async () => {
  const local = storage();
  local.setItem('from-crmeb-admin:TENANT_CURRENT', JSON.stringify({ id: 99 }));
  local.setItem('from-crmeb-admin:TENANT_LIST', JSON.stringify([{ id: 99 }]));
  local.setItem('menuList', JSON.stringify([{ path: '/startup-old' }]));
  const f = await fixture(local); seed(f);
  for (let i = 0; i < 2; i++) {
    f.util.setCookies('token', `admin-${i}`);
    f.store.commit('tenant/setContext', { current: { id: i + 1 } });
    f.store.commit('userInfo/uniqueAuth', ['new-permission']);
    f.clearSession(f.captureSession()); assertCleared(f);
  }
});
test('staff invalidation preserves admin memory and persisted permissions', async () => {
  const f = await fixture(); seed(f);
  const before = plain(f.store.state);
  const reply = f.request({ url: '/info', kefu: true }); await tick();
  f.pending[0].resolve({ status: 402 }); await assert.rejects(reply);
  assert.equal(f.cookies.token, 'admin-a'); assert.equal(f.cookies.kefu_token, undefined);
  for (const state of [plain(f.store.state), JSON.parse(f.local.getItem('vuex'))]) {
    assert.deepEqual(state.tenant, before.tenant); assert.deepEqual(state.userInfo, before.userInfo);
    assert.equal(state.kefu.kefuInfo, null);
  }
});
