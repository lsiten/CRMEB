const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const compiler = require('vue-template-compiler');

function setup(code) {
  const source = fs.readFileSync(path.join(__dirname, '../src/pages/account/login/index.vue'), 'utf8');
  const component = compiler.parseComponent(source);
  const script = component.script.content.replace(/^import .*;$/gm, '').replace('export default', 'return');
  const requests = [];
  const options = new Function('AccountLogin', 'Verify', 'setTimeout', script)(
    (body) => { requests.push(body); return Promise.reject({ msg: '账号或密码错误', data: { login_captcha: 1 } }); },
    {}, (fn) => fn(),
  );
  const vm = { formInline: { username: 'shared', password: 'test-only', tenant_code: code }, key: 'captcha-key',
    $message: { error: () => {} }, ...options.methods };
  return { vm, requests, template: component.template.content };
}
for (const [input, expected] of [['', undefined], ['   ', undefined], [' b ', 'b']]) {
  test(`租户编码 ${JSON.stringify(input)} 与验证码同次提交`, async () => {
    const { vm, requests } = setup(input);
    vm.closeModel({ captchaVerification: 'verified-captcha' });
    await new Promise(setImmediate);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].tenant_code, expected);
    assert.equal(requests[0].captchaVerification, 'verified-captcha');
    assert.equal(requests[0].key, 'captcha-key');
    assert.equal(requests[0].account, 'shared');
    assert.equal(vm.login_captcha, 1);
  });
}
test('验证码开启时先展示验证码，通过后才登录', () => {
  const { vm, requests } = setup('a');
  let shown = 0;
  vm.login_captcha = 1;
  vm.$refs = { formInline: { validate: (fn) => fn(true) }, verify: { show: () => shown++ } };
  vm.handleSubmit('formInline');
  assert.equal(shown, 1);
  assert.equal(requests.length, 0);
});
test('实际登录模板可编译并保留可选编码说明', () => {
  const { template } = setup('');
  assert.deepEqual(compiler.compile(template).errors, []);
  assert.match(template, /maxlength="64"/);
  assert.match(template, /aria-describedby="tenant-code-hint"/);
});
