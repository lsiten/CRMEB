import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const tick = () => new Promise((resolve) => setImmediate(resolve));
async function fixture() {
  const source = await readFile(new URL('../src/store/module/kefu.js', import.meta.url), 'utf8');
  const script = source.replace(/^import .*;$/gm, '').replace('export default', 'return');
  const cookies = { token: 'admin', kefu_token: 'staff', kefu_uuid: 1, kefuInfo: '{}' };
  let resolve, socketResolve;
  const effects = [];
  const reply = new Promise((done) => { resolve = done; });
  const socket = new Promise((done) => { socketResolve = done; });
  const current = (s) => s.token === cookies.kefu_token;
  const bindings = {
    AccountLogoutKefu: () => reply,
    getCookies: (key) => cookies[key], removeCookies: (key) => delete cookies[key], setCookies() {},
    captureSession: () => ({ token: cookies.kefu_token }), isCurrentSession: current,
    clearSession(s) { if (!current(s)) return false; for (const k of ['kefu_token', 'kefu_uuid', 'kefuInfo']) delete cookies[k]; return true; },
    sessionChangedError: () => ({ code: 'SESSION_CHANGED' }),
    router: { push: (route) => { effects.push(['route', route.path]); return Promise.resolve(); } },
    Socket: socket, console: { log() {} },
  };
  const module = new Function(...Object.keys(bindings), script)(...Object.values(bindings));
  const run = () => module.actions.logoutKefu({ commit: (...args) => effects.push(['commit', ...args]) });
  return { cookies, effects, run, resolve, socketResolve };
}
test('staff logout clears only staff session and Vuex info', async () => {
  const f = await fixture(); const p = f.run(); f.resolve({ status: 200 }); await p; await tick();
  assert.equal(f.cookies.token, 'admin'); assert.equal(f.cookies.kefu_token, undefined);
  assert.ok(f.effects.some((e) => e[0] === 'commit' && e[1] === 'setInfo' && e[2] === null));
});
test('late logout response cannot clear or redirect a new staff login', async () => {
  const f = await fixture(); const p = f.run(); f.cookies.kefu_token = 'new-staff'; f.resolve({ status: 200 });
  await p; await tick(); assert.equal(f.cookies.kefu_token, 'new-staff'); assert.deepEqual(f.effects, []);
});
test('late socket resolution never logs out a replacement staff session', async () => {
  const f = await fixture(); const p = f.run(); f.resolve({ status: 200 }); await p; await tick();
  f.cookies.kefu_token = 'new-staff'; f.cookies.kefu_uuid = 2;
  f.socketResolve({ send: (value) => { f.effects.push(['socket', value]); return Promise.resolve(); } });
  await tick(); assert.ok(!f.effects.some((e) => e[0] === 'socket'));
});
