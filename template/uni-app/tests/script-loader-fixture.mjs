import { readFile } from 'node:fs/promises';

// Run the real H5 launch hook and transport/session code without the UniApp SDK.
function h5(source) {
  const active = [true];
  return source.split('\n').filter(line => {
    const directive = line.match(/^\s*\/\/\s*#(ifdef|ifndef|endif)\s*(.*)$/);
    if (!directive) return active.every(Boolean);
    if (directive[1] === 'endif') active.pop();
    else {
      const matches = directive[2].split('||').some(platform => platform.trim() === 'H5');
      active.push(directive[1] === 'ifdef' ? matches : !matches);
    }
    return false;
  }).join('\n');
}

function withoutImports(source) {
  return source.replace(/^import\s[\s\S]*?from\s+['"][^'"]+['"];?/gm, '')
    .replace(/^export \{[^}]+\};?$/gm, '').replace(/^export /gm, '');
}

export async function fixtureSource() {
  const read = name => readFile(new URL(`../${name}`, import.meta.url), 'utf8');
  const app = h5(await read('App.vue'));
  const launch = app.slice(app.indexOf('  async onLaunch(option) {'), app.indexOf('  onHide() {'));
  if (!launch.startsWith('  async onLaunch') || !launch.trim().endsWith('},')) throw new Error('Launch hook not found');
  const session = withoutImports(await read('utils/tenant-session.mjs'));
  const tenant = withoutImports(await read('utils/tenant.js'));
  const request = withoutImports(await read('utils/request.js')).replace('default request;', '');
  return `(() => {
    const calls = [], storage = new Map(), errors = [];
    const state = { app: { token: false, sessionRevision: 0 } };
    const store = { state, commit(name) { if (name === 'LOGOUT') { state.app.token = false; state.app.sessionRevision++; } } };
    const HTTP_REQUEST_URL = globalThis.fixtureOrigin || 'http://fixture.test';
    const HEADER = {}, TOKENNAME = 'Authori-zation', TIMEOUT = 1000;
    const checkLogin = () => true, toLogin = () => {}, i18n = { t: text => text };
    const console = { error: error => errors.push(error?.code || String(error)) };
    const uni = {
      hideTabBar() {}, getSystemInfo() {}, reLaunch() {},
      getStorageSync: key => storage.get(key), setStorageSync: (key, value) => storage.set(key, value),
      clearStorageSync: () => storage.clear(),
      request(options) { calls.push(options); globalThis.deliverScript(options); }
    };
    const basicConfig = async () => ({ data: {} });
    const getLangVersion = async () => ({ data: { version: undefined } });
    const getCrmebCopyRight = basicConfig, applyTheme = () => {};
    ${session}
    ${tenant}
    ${request}
    const app = { globalData: {}, ${launch} };
    function getApp() { return app; }
    globalThis.fixture = {
      calls, storage, errors, state, tenantSession,
      injectTenantCredentials, clearTenantCredentials, switchTenant,
      launch: () => app.onLaunch({ query: {} }),
      change(action) {
        if (action === 'clear') clearTenantCredentials();
        if (action === 'tenant') return switchTenant({ appid: 'fixture-b', screct_id: 'fixture-secret-b' });
        if (action === 'account') { state.app.token = 'fixture-user-b'; state.app.sessionRevision++; }
      }
    };
    initializeTenantState();
  })();`;
}
