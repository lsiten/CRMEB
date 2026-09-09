import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const axios = require('axios');
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function fixture(routerReturnsPromise = true) {
  const cookies = { token: 'admin-a', kefu_token: 'staff-a', kefuInfo: 'staff-info' };
  const revisions = { token: 0, kefu_token: 0 };
  const calls = [], pending = [], effects = [];
  const util = {
    getCookies: (key) => cookies[key],
    getSessionRevision: (key) => revisions[key],
    setCookies(key, value) { cookies[key] = value; if (key in revisions) revisions[key]++; },
    removeCookies(key) { delete cookies[key]; if (key in revisions) revisions[key]++; },
  };
  const context = vm.createContext({ Promise, Object, Error, JSON, console,
    localStorage: { clear: () => effects.push('global-clear') } });
  const mockAxios = { defaults: {}, create(options) {
    const client = axios.create(options);
    client.defaults.adapter = (config) => new Promise((resolve, reject) => {
      calls.push(config);
      pending.push({ resolve: (data) => resolve({ data, config }),
        reject: (status) => reject({ config, response: { status, config } }) });
    });
    return client;
  } };
  const mocks = {
    axios: { default: mockAxios }, '@/libs/util': util,
    '@/utils/tenant': { clearTenantContext: () => effects.push('tenant-clear') },
    '@/store': { default: { commit: (name, value) => effects.push([name, value]) } },
    '@/setting': { default: { apiBaseURL: '/adminapi' } },
    '@/router': { default: { replace: (value) => { effects.push(value); return routerReturnsPromise ? Promise.resolve() : undefined; } } },
    'element-ui': { Message: { error: () => effects.push('message') } },
  };
  const cache = new Map();
  async function load(name) {
    if (cache.has(name)) return cache.get(name);
    const mod = new vm.SourceTextModule(await readFile(new URL(`../src/libs/${name}.js`, import.meta.url), 'utf8'), { context });
    cache.set(name, mod);
    await mod.link((specifier) => {
      if (!mocks[specifier]) return load(specifier.split('/').pop().replace(/\.js$/, ''));
      const values = mocks[specifier];
      return new vm.SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context });
    });
    return mod;
  }
  const mod = await load('request'); await mod.evaluate();
  return { request: mod.namespace.default, cookies, util, effects, calls, pending };
}

for (const kefu of [false, true]) {
  const own = kefu ? 'kefu_token' : 'token';
  const other = kefu ? 'token' : 'kefu_token';
  test(`${own}: authentication error remains readable when router returns undefined`, async () => {
    const f = await fixture(false); const p = f.request({ url: '/info', kefu }); await tick();
    f.pending[0].resolve({ status: 401 }); await assert.rejects(p, (e) => e.msg === '未登录');
  });
  test(`${own}: requests use only their own token with both sessions present`, async () => {
    const f = await fixture();
    const p = f.request({ url: '/info', kefu }); await tick();
    assert.equal(f.calls[0].headers['Authori-zation'], `Bearer ${f.cookies[own]}`);
    assert.equal(f.calls[0].baseURL, kefu ? '/kefuapi' : '/adminapi');
    f.pending[0].resolve({ status: 200 }); await p;
  });
  test(`${own}: absent token never falls back or preserves a supplied bearer`, async () => {
    const f = await fixture(); delete f.cookies[own];
    const p = f.request({ url: '/info', kefu, headers: { 'Authori-zation': 'Bearer wrong' } }); await tick();
    assert.equal(f.calls[0].headers['Authori-zation'], undefined);
    f.pending[0].resolve({ status: 200 }); await p;
  });
  for (const status of [401, 402, 419]) {
    test(`${own}: business ${status} clears only its session`, async () => {
      const f = await fixture(); const otherValue = f.cookies[other];
      const p = f.request({ url: '/info', kefu }); await tick();
      f.pending[0].resolve({ status }); await assert.rejects(p);
      assert.equal(f.cookies[own], undefined);
      assert.equal(f.cookies[other], otherValue);
      assert.ok(!f.effects.includes('global-clear'));
      assert.equal(f.effects.includes('tenant-clear'), !kefu);
      assert.equal(f.effects.some((e) => Array.isArray(e) && e[0] === 'kefu/setInfo' && e[1] === null), kefu);
    });
  }
  for (const outcome of ['success', 'invalid', 'http401']) {
    test(`${own}: late ${outcome} cannot affect a replacement session`, async () => {
      const f = await fixture(); const p = f.request({ url: '/info', kefu }); await tick();
      f.util.setCookies(own, 'replacement');
      if (outcome === 'http401') f.pending[0].reject(401);
      else f.pending[0].resolve({ status: outcome === 'success' ? 200 : 401 });
      await assert.rejects(p, (e) => e.code === 'SESSION_CHANGED');
      assert.equal(f.cookies[own], 'replacement'); assert.deepEqual(f.effects, []);
    });
  }
  test(`${own}: clear and restore same token still invalidates old responses`, async () => {
    const f = await fixture(); const original = f.cookies[own];
    const p = f.request({ url: '/info', kefu }); await tick();
    f.util.removeCookies(own); f.util.setCookies(own, original);
    f.pending[0].resolve({ status: 200 }); await assert.rejects(p, (e) => e.code === 'SESSION_CHANGED');
  });
  test(`${own}: changes to other session do not discard own response`, async () => {
    const f = await fixture(); const p = f.request({ url: '/info', kefu }); await tick();
    f.util.setCookies(other, 'replacement'); f.pending[0].resolve({ status: 200 });
    assert.equal((await p).status, 200);
  });
}
