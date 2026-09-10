const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

function fixture() {
  let token = 'a', revision = 0;
  const pending = [], storage = new Map([['ADMIN_TITLE', '甲']]);
  const state = { app: { adminTitle: '甲' } };
  const context = {
    window: { addEventListener() {} },
    Local: {}, mapMutations: () => ({}), getNewTagList() {},
    getLogo: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
    captureSession: () => ({ token, revision }),
    isCurrentSession: (s) => s.token === token && s.revision === revision,
    localStorage: { setItem: (k, v) => storage.set(k, v), removeItem: (k) => storage.delete(k) },
    setTitle: (route) => { context.title = `${storage.get('ADMIN_TITLE') || 'CRMEB'} - ${route.name}`; },
  };
  const source = fs.readFileSync(process.env.TITLE_LAYOUT_SOURCE || `${__dirname}/../src/layout/index.vue`, 'utf8')
    .split('<script>')[1].split('</script>')[0].replace(/^import .*;$/gm, '').replace('export default', 'component =');
  vm.runInNewContext(source, context);
  const mount = () => {
    const instance = { ...context.component.data(), $route: { name: '首页' }, $root: {},
      $store: { state, commit: (_, v) => { state.app.adminTitle = v; } } };
    Object.assign(instance, context.component.methods);
    return instance;
  };
  return { context, storage, state, pending, mount, switchToken(value) { token = value; revision++; },
    start() {
      const instance = mount();
      instance.$route.meta = {};
      instance.onLayoutResize = () => {};
      let task;
      const refresh = instance.refreshAdminTitle;
      instance.refreshAdminTitle = () => { task = refresh.call(instance); return task; };
      context.component.created.call(instance);
      return task;
    } };
}

test('布局created主动刷新而非恢复持久化的甲标题', async () => {
  const f = fixture(); f.switchToken('b');
  const task = f.start();
  assert.equal(f.state.app.adminTitle, '', '乙布局初始化必须先移除持久化的甲标题');
  assert.equal(f.pending.length, 1);
  f.pending.shift().resolve({ data: { site_name: '乙' } }); await task;
  assert.equal(f.state.app.adminTitle, '乙');
});

test('甲→乙→甲及刷新从当前租户配置恢复标题，等待期间清除旧标题', async () => {
  const f = fixture();
  for (const [token, title] of [['a', '甲'], ['b', '乙'], ['a', '甲'], ['a', '甲']]) {
    f.switchToken(token);
    const instance = f.mount();
    const task = instance.refreshAdminTitle();
    assert.equal(f.state.app.adminTitle, '');
    assert.equal(f.storage.has('ADMIN_TITLE'), false);
    f.pending.shift().resolve({ data: { site_name: title } });
    await task;
    assert.equal(f.state.app.adminTitle, title);
    assert.equal(f.context.title, `${title} - 首页`);
  }
});
for (const outcome of ['success', 'failure']) {
  test(`迟到${outcome}不能覆盖新租户标题，包括甲→乙→甲同token代际`, async () => {
    const f = fixture(), old = f.mount();
    const first = old.refreshAdminTitle();
    const stale = f.pending.shift();
    f.switchToken('b'); f.switchToken('a');
    const current = f.mount().refreshAdminTitle();
    f.pending.shift().resolve({ data: { site_name: '新甲' } }); await current;
    if (outcome === 'success') stale.resolve({ data: { site_name: '旧甲' } });
    else stale.reject(new Error('late'));
    await first;
    assert.equal(f.state.app.adminTitle, '新甲');
    assert.equal(f.context.title, '新甲 - 首页');
  });
}
test('销毁布局后的响应不修改标题，空配置及失败不保留旧租户名', async () => {
  const f = fixture(), instance = f.mount();
  const task = instance.refreshAdminTitle(); instance._isDestroyed = true;
  f.pending.shift().resolve({ data: { site_name: '旧甲' } }); await task;
  assert.equal(f.state.app.adminTitle, '');
  const next = f.mount().refreshAdminTitle();
  f.pending.shift().reject(new Error('offline')); await next;
  assert.equal(f.storage.has('ADMIN_TITLE'), false);
  const empty = f.mount().refreshAdminTitle();
  f.pending.shift().resolve({ data: { site_name: '' } }); await empty;
  assert.equal(f.state.app.adminTitle, '');
});
