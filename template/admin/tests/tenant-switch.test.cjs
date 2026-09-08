const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Vue = require('vue');
const compiler = require('vue-template-compiler');

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() {
  for (let i = 0; i < 12; i++) await Vue.nextTick();
}
function setup() {
  const source = fs.readFileSync(path.join(__dirname, '../src/layout/navBars/breadcrumb/user.vue'), 'utf8');
  const script = compiler.parseComponent(source).script.content
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '').replace('export default', 'return');
  const reply = deferred();
  const menu = deferred();
  const writes = [];
  const cookies = { token: 'session-a' };
  const bindings = {
    UserNews: {}, Search: {}, TenantCredentials: {},
    getCookies: (key) => cookies[key],
    setCookies: (key, value) => { cookies[key] = value; writes.push(['cookie', key]); },
    switchTenantApi: () => reply.promise,
    menusApi: () => menu.promise,
    tenantListApi: async () => ({ data: [] }),
    Local: { set: (...args) => writes.push(['local', ...args]) },
    window: { location: { reload: () => writes.push(['reload']) } },
    formatFlatteningRoutes: (value) => value,
  };
  const options = new Function(...Object.keys(bindings), script)(...Object.values(bindings));
  const state = Vue.observable({ userInfo: { userInfo: { id: 1, account: 'a', level: 0, tenant_id: 1 }, uniqueAuth: [] },
    tenant: { current: { id: 1 }, list: [{ id: 1 }, { id: 2 }, { id: 3 }] } });
  const vm = new Vue({ ...options, beforeCreate() {
    this.$store = { state, commit: (...args) => writes.push(['commit', ...args]), dispatch: (...args) => writes.push(['dispatch', ...args]) };
    this.$route = Vue.observable({ fullPath: '/admin/home' });
  } });
  vm.$message = { success: (...args) => writes.push(['success', ...args]), error: (...args) => writes.push(['error', ...args]) };
  vm.bus = { $emit: (...args) => writes.push(['event', ...args]) };
  vm.selectedTenantId = 2;
  return { vm, state, cookies, writes, reply, menu };
}
const result = { data: { token: 'old-switch', expires_time: 9999999999, tenant: { id: 2 }, menus: [] } };

for (const change of ['close', 'account', 'cookie', 'destroy', 'route']) {
  test(`切换响应迟到：${change} 后不写状态、cookie、菜单或刷新`, async () => {
    const s = setup();
    s.vm.tenantDialogVisible = true;
    await flush();
    s.vm.switchTenant();
    if (change === 'close') s.vm.tenantDialogVisible = false;
    if (change === 'account') s.state.userInfo.userInfo = { id: 9, account: 'b', level: 1, tenant_id: 2 };
    if (change === 'cookie') s.cookies.token = 'session-b';
    if (change === 'destroy') s.vm.$destroy();
    if (change === 'route') s.vm.$route.fullPath = '/admin/other';
    await flush();
    s.reply.resolve(result);
    await flush();
    assert.deepEqual(s.writes, []);
    s.vm.$destroy();
  });
}
test('菜单请求期间换账号，旧菜单不能写入或刷新', async () => {
  const s = setup();
  s.vm.switchTenant();
  s.reply.resolve({ data: { token: 'switch-token', tenant: { id: 2 } } });
  await flush();
  s.state.userInfo.userInfo = { id: 9, account: 'b', level: 0, tenant_id: 1 };
  s.cookies.token = 'session-b';
  await flush();
  s.writes.length = 0;
  s.menu.resolve({ data: [{ path: '/old-menu' }] });
  await flush();
  assert.deepEqual(s.writes, []);
  s.vm.$destroy();
});
test('下拉切换正常完成，重复点击不改变首请求目标', async () => {
  const s = setup();
  s.vm.onTenantCommand(2);
  s.vm.onTenantCommand(3);
  s.reply.resolve({ data: { menus: [] } });
  await flush();
  const context = s.writes.find((row) => row[1] === 'tenant/setContext');
  assert.equal(context[2].current.id, 2);
  assert.equal(s.writes.filter((row) => row[0] === 'reload').length, 1);
  s.vm.$destroy();
});
test('关闭后的失败响应不弹错误，也不清除新请求的 loading', async () => {
  const s = setup();
  s.vm.tenantDialogVisible = true;
  await flush();
  s.vm.switchTenant();
  s.vm.tenantDialogVisible = false;
  await flush();
  s.vm.tenantSwitching = true;
  s.reply.reject({ msg: 'old failure' });
  await flush();
  assert.deepEqual(s.writes, []);
  assert.equal(s.vm.tenantSwitching, true);
  s.vm.$destroy();
});
test('菜单请求期间关闭弹窗，旧菜单不能写入', async () => {
  const s = setup();
  s.vm.tenantDialogVisible = true;
  await flush();
  s.vm.switchTenant();
  s.reply.resolve({ data: { token: 'switch-token', tenant: { id: 2 } } });
  await flush();
  s.vm.tenantDialogVisible = false;
  await flush();
  s.writes.length = 0;
  s.menu.resolve({ data: [{ path: '/old' }] });
  await flush();
  assert.deepEqual(s.writes, []);
  s.vm.$destroy();
});
test('正常 token 轮换后异步菜单仍应用并仅刷新一次', async () => {
  const s = setup();
  s.vm.switchTenant();
  s.reply.resolve({ data: { token: 'new-token', tenant: { id: 2 } } });
  await flush();
  assert.equal(s.cookies.token, 'new-token');
  s.menu.resolve({ data: [{ path: '/current' }] });
  await flush();
  assert.equal(s.writes.find((row) => row[1] === 'menus/getmenusNav')[2][0].path, '/current');
  assert.equal(s.writes.filter((row) => row[0] === 'reload').length, 1);
  s.vm.$destroy();
});
