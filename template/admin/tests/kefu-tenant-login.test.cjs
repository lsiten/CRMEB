const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compiler = require('vue-template-compiler');
const source = fs.readFileSync(path.join(__dirname, '../src/pages/kefu/index.vue'), 'utf8');
const component = compiler.parseComponent(source);
function setup(code, mobile = false, success = false) {
  const requests = [], cookies = [], routes = [], errors = [];
  const script = component.script.content.replace(/^import .*;$/gm, '').replace('export default', 'return');
  const options = new Function('mixins', 'AccountLogin', 'setCookies', script)({}, (body) => {
    requests.push(body);
    return success ? Promise.resolve({ data: { exp_time: 2000000000, token: 'staff-only', kefuInfo: { uid: 2 } } })
      : Promise.reject({ msg: '账号或密码错误' });
  }, (...args) => cookies.push(args));
  let resets = 0;
  const vm = { ...options.methods, formInline: { username: 'shared', password: 'test-only', code: 'captcha-123', tenant_code: code },
    errorNum: 0, captchas() { resets++; }, $message: { error: (msg) => errors.push(msg) },
    $store: { state: { media: { isMobile: mobile } }, commit() {} },
    $route: { query: {} }, $router: { replace: (route) => routes.push(route) } };
  return { vm, requests, cookies, routes, errors, resets: () => resets };
}
for (const mobile of [false, true]) {
  for (const [input, expected] of [['', undefined], ['   ', undefined], [' tenant-b ', 'tenant-b'], ['租'.repeat(64), '租'.repeat(64)]]) {
    test(`${mobile ? 'mobile' : 'PC'}: optional code ${JSON.stringify(input)}`, async () => {
      const f = setup(input, mobile);
      f.vm.closeModel(); await new Promise(setImmediate);
      const body = { account: 'shared', password: 'test-only', imgcode: 'captcha-123' };
      if (expected !== undefined) body.tenant_code = expected;
      assert.deepEqual(f.requests, [body]);
      assert.deepEqual(f.cookies, []);
      assert.deepEqual(f.errors, ['账号或密码错误']);
      assert.equal(f.resets(), 1);
    });
  }
  test(`${mobile ? 'mobile' : 'PC'}: successful login preserves staff cookie and destination`, async () => {
    const f = setup(' b ', mobile, true);
    f.vm.closeModel(); await new Promise(setImmediate);
    assert.deepEqual(f.cookies.map(([key]) => key), ['kefu_uuid', 'kefu_token', 'kefu_expires_time', 'kefuInfo']);
    assert.deepEqual(f.routes, [{ path: mobile ? '/kefu/mobile_list' : '/kefu/pc_list' }]);
  });
}
test('invalid required form blocks login; valid form sends once', () => {
  const f = setup('');
  f.vm.$refs = { form: { validate: (cb) => cb(false) } };
  f.vm.handleSubmit('form'); assert.equal(f.requests.length, 0);
  f.vm.$refs.form.validate = (cb) => cb(true);
  f.vm.handleSubmit('form'); assert.equal(f.requests.length, 1);
});
test('actual shared template compiles and exposes optional input accessibly', () => {
  assert.deepEqual(compiler.compile(component.template.content).errors, []);
  assert.match(component.template.content, /maxlength="64"/);
  assert.match(component.template.content, /aria-describedby="kefu-tenant-code-hint"/);
  assert.match(component.template.content, /同名账号请填写所属租户编码/);
});
