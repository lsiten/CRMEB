const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compiler = require('vue-template-compiler');
const tick = () => new Promise((resolve) => setImmediate(resolve));

function fixture() {
  const source = fs.readFileSync(path.join(__dirname, '../src/layout/navBars/breadcrumb/user.vue'), 'utf8');
  const script = compiler.parseComponent(source).script.content.replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '').replace('export default', 'return');
  const cookies = { token: 'admin', kefu_token: 'staff' };
  const effects = [], timers = [];
  let resolve, closed;
  const reply = new Promise((done) => { resolve = done; });
  const modal = new Promise((done) => { closed = done; });
  const bindings = {
    UserNews: {}, Search: {}, TenantCredentials: {},
    getCookies: (k) => cookies[k], removeCookies: (k) => delete cookies[k],
    captureSession: () => ({ token: cookies.token }), isCurrentSession: (s) => !!s && s.token === cookies.token,
    clearSession(s) { if (s.token !== cookies.token) return false; delete cookies.token; return true; },
    AccountLogout: () => reply, Session: { clear: () => effects.push('session-clear'), remove: (key) => effects.push(['session-remove', key]) },
    setTimeout: (fn) => timers.push(fn), window: { location: { reload: () => effects.push('reload') } },
  };
  const options = new Function(...Object.keys(bindings), script)(...Object.values(bindings));
  const ctx = { $t: (s) => s, invalidateTenantRequests() {},
    $message: { success: () => effects.push('success') },
    $store: { commit: (...args) => effects.push(['commit', ...args]) },
    $router: { replace: (...args) => effects.push(['route', ...args]) },
    $msgbox(config) { config.beforeClose('confirm', {}, () => closed()); return modal; },
  };
  const run = () => { options.methods.onDropdownCommand.call(ctx, 'logOut'); timers.shift()(); };
  return { cookies, effects, timers, resolve, run };
}
test('late admin logout does not clear, reload or redirect a new login', async () => {
  const f = fixture(); f.run(); f.cookies.token = 'new-admin'; f.resolve({ status: 200 });
  await tick(); while (f.timers.length) f.timers.shift()(); await tick();
  assert.equal(f.cookies.token, 'new-admin'); assert.equal(f.cookies.kefu_token, 'staff');
  assert.deepEqual(f.effects, []);
});
test('admin logout preserves staff and delayed navigation respects replacement login', async () => {
  const f = fixture(); f.run(); f.resolve({ status: 200 }); await tick();
  assert.equal(f.cookies.token, undefined); assert.equal(f.cookies.kefu_token, 'staff');
  f.effects.length = 0; f.cookies.token = 'new-admin';
  while (f.timers.length) f.timers.shift()(); await tick();
  assert.ok(!f.effects.some((e) => e === 'reload' || e === 'session-clear' || e[0] === 'route'));
});
