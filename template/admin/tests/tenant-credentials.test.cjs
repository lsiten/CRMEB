const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Vue = require('vue');
const compiler = require('vue-template-compiler');

function setup(overrides = {}, tenantId = 2) {
  const source = fs.readFileSync(path.join(__dirname, '../src/components/tenantCredentials/index.vue'), 'utf8');
  const component = compiler.parseComponent(source);
  const script = component.script.content.replace(/import[\s\S]*?from ['"][^'"]+['"];?/g, '').replace('export default', 'return');
  const calls = [];
  const api = {
    tenantCredentialsApi: async (id) => {
      calls.push(['get', id]);
      return { data: { generated: false, client_id: '' } };
    },
    tenantCredentialsGenerateApi: async (id) => {
      calls.push(['generate', id]);
      return { data: { client_id: 'fixture-client', app_secret: 'fixture-secret' } };
    },
    tenantCredentialsResetApi: async (id) => {
      calls.push(['reset', id]);
      return { data: { client_id: 'fixture-client', app_secret: 'fixture-reset' } };
    },
    ...overrides,
  };
  const options = new Function(...Object.keys(api), script)(...Object.values(api));
  const state = Vue.observable({ tenant: { current: { id: tenantId } }, userInfo: { userInfo: { id: 2, tenant_id: tenantId, level: 1 } } });
  const vm = new Vue({ ...options, propsData: { tenantId }, beforeCreate() { this.$store = { state }; } });
  vm.$confirm = async () => {};
  return { vm, calls, template: component.template.content };
}

test('首次生成只请求自身租户，信息对象不持有 secret', async () => {
  const { vm, calls } = setup();
  await vm.load();
  await vm.submit();
  assert.deepEqual(calls, [['get', 2], ['generate', 2]]);
  assert.equal(vm.secret, 'fixture-secret');
  assert.equal(vm.info.generated, true);
  assert.equal('app_secret' in vm.info, false);
  await vm.submit();
  assert.equal(calls.length, 2);
  vm.$destroy();
  assert.equal(vm.secret, '');
});

test('关闭清除 secret，重开查询不恢复 secret', async () => {
  const { vm } = setup();
  await vm.load();
  await vm.submit();
  vm.close();
  assert.equal(vm.secret, '');
  assert.equal(vm.info, null);
  await vm.load();
  assert.equal(vm.secret, '');
});

test('重置取消不发送 POST；确认重置保留 ID', async () => {
  const { vm, calls } = setup();
  vm.info = { generated: true, client_id: 'fixture-client' };
  vm.$confirm = async () => { throw 'cancel'; };
  await vm.submit();
  assert.equal(calls.length, 0);
  assert.equal(vm.busy, false);
  vm.$confirm = async () => {};
  await vm.submit();
  assert.deepEqual(calls, [['reset', 2]]);
  assert.equal(vm.info.client_id, 'fixture-client');
  assert.equal(vm.secret, 'fixture-reset');
});

test('409 不自动重试或轮换，须先查询状态', async () => {
  let attempts = 0;
  const { vm } = setup({ tenantCredentialsGenerateApi: async () => {
    attempts += 1;
    throw { status: 409, msg: '凭据已生成' };
  } });
  await vm.load();
  await vm.submit();
  await vm.submit();
  assert.equal(attempts, 1);
  assert.match(vm.error, /重新查询/);
  assert.equal(vm.secret, '');
});

test('网络错误后不自动重复提交', async () => {
  const { vm } = setup({ tenantCredentialsGenerateApi: async () => { throw new Error('network'); } });
  await vm.load();
  await vm.submit();
  assert.match(vm.error, /提交结果未确认/);
  assert.equal(vm.busy, false);
});

test('组件销毁后迟到的生成响应不能恢复密钥', async () => {
  let resolve;
  const { vm } = setup({ tenantCredentialsGenerateApi: () => new Promise((done) => { resolve = done; }) });
  await vm.load();
  const pending = vm.submit();
  assert.equal(vm.busy, true);
  vm.$destroy();
  resolve({ data: { client_id: 'fixture-client', app_secret: 'late-secret' } });
  await pending;
  assert.equal(vm.secret, '');
  assert.equal(vm.info, null);
});

test('切换租户后旧查询不能覆盖新租户状态', async () => {
  let resolve;
  const { vm } = setup({ tenantCredentialsApi: (id) => id === 2
    ? new Promise((done) => { resolve = done; })
    : Promise.resolve({ data: { generated: true, client_id: 'tenant-3' } }) });
  const pending = vm.load();
  vm.tenantId = 3;
  await Vue.nextTick();
  await Vue.nextTick();
  resolve({ data: { generated: true, client_id: 'tenant-2' } });
  await pending;
  assert.equal(vm.info.client_id, 'tenant-3');
  assert.equal(vm.secret, '');
});

test('等待重置确认期间离开，不发送重置请求', async () => {
  let resolve;
  const { vm, calls } = setup();
  vm.info = { generated: true, client_id: 'fixture-client' };
  vm.$confirm = () => new Promise((done) => { resolve = done; });
  const pending = vm.submit();
  vm.close();
  resolve();
  await pending;
  assert.equal(calls.length, 0);
});

test('未知 tenantId 不发请求，查询失败不能生成', async () => {
  const { vm, calls } = setup({}, 0);
  await vm.load();
  assert.equal(calls.length, 0);
  assert.match(vm.error, /有效租户/);
  const denied = setup({ tenantCredentialsApi: async () => { throw { status: 403, msg: '没有权限' }; } });
  await denied.vm.load();
  await denied.vm.submit();
  assert.equal(denied.calls.length, 0);
  assert.equal(denied.vm.info, null);
});

test('只读查询即使意外返回 secret 也不保留', async () => {
  const { vm } = setup({ tenantCredentialsApi: async () => ({ data: {
    generated: true, client_id: 'fixture-client', app_secret: 'unexpected-secret',
  } }) });
  await vm.load();
  assert.equal(vm.secret, '');
  assert.equal('app_secret' in vm.info, false);
});

test('实际 Vue 模板可以编译', () => {
  const { template } = setup();
  assert.deepEqual(compiler.compile(template).errors, []);
});

test('列表弹窗目标不变时，切换全局租户也清除密钥', async () => {
  const { vm } = setup();
  await vm.load();
  await vm.submit();
  vm.$store.state.tenant.current = { id: 3 };
  await Vue.nextTick();
  assert.equal(vm.tenantId, 2);
  assert.equal(vm.secret, '');
});

test('同租户更换登录账号也清除密钥', async () => {
  const { vm } = setup();
  await vm.load();
  await vm.submit();
  vm.$store.state.userInfo.userInfo.id = 4;
  await Vue.nextTick();
  assert.equal(vm.secret, '');
});
