// Local contract fixture: never forwards requests or connects to a database.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../dist');
const tenants = [{ id: 2, name: '测试租户甲', code: 'fixture-a', status: 1 }, { id: 3, name: '测试租户乙', code: 'fixture-b', status: 1 }];
const credentials = new Map();
const events = [];
let nextFailure = 0;
const systemMenu = { path: '/admin/system', name: 'system', meta: { title: '系统设置', icon: 'el-icon-setting' }, children: [
  { path: '/admin/system/tenant', name: 'system_tenant', meta: { title: '租户管理', auth: ['admin-tenant-index'] } },
] };
const selfMenu = { path: '/admin/setting', name: 'setting', meta: { title: '设置', icon: 'el-icon-setting' }, children: [
  { path: '/admin/system/user', name: 'systemUser', meta: { title: '个人中心' } },
] };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const send = (data, status = 200, msg = 'ok') => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ status, msg, data }));
  };
  let body = '';
  for await (const chunk of req) body += chunk;
  const input = body ? JSON.parse(body) : {};
  const superAdmin = String(req.headers['authori-zation'] || '').includes('fixture-super');
  const menus = superAdmin ? [systemMenu] : [selfMenu];
  if (url.pathname === '/__qa/events') return send(events);
  if (url.pathname === '/__qa/fail') { nextFailure = input.status; return send({}); }
  if (url.pathname.startsWith('/adminapi/')) {
    events.push({ method: req.method, path: url.pathname, role: superAdmin ? 'super' : 'tenant' });
    if (url.pathname.endsWith('/login/info')) return send({ site_name: 'LSIT-21 契约模拟验证', login_captcha: 0 });
    if (url.pathname === '/adminapi/login') {
      const admin = input.account === 'fixture-super';
      return send({ token: admin ? 'fixture-super' : 'fixture-tenant', expires_time: Math.floor(Date.now() / 1000) + 3600,
        user_info: { id: admin ? 1 : 2, level: admin ? 0 : 1, tenant_id: 2, account: input.account, head_pic: '' },
        menus: admin ? [systemMenu] : [selfMenu], unique_auth: admin ? ['admin-system', 'admin-tenant-index'] : ['admin-setting'],
        current_tenant: tenants[0], tenants: admin ? tenants : [], site_func: [], queue: true, timer: true,
      });
    }
    if (url.pathname === '/adminapi/menus') return send({ menus, unique_auth: superAdmin ? ['admin-system', 'admin-tenant-index'] : ['admin-setting'] });
    if (url.pathname === '/adminapi/tenant/list') return send({ list: tenants });
    if (url.pathname === '/adminapi/setting/tenant') return superAdmin ? send({ list: tenants }) : send(null, 403, '无权操作租户');
    const match = url.pathname.match(/^\/adminapi\/tenant\/credentials\/(\d+)(\/reset)?$/);
    if (match) {
      const id = Number(match[1]);
      if (!superAdmin && id !== 2) return send(null, 403, '无权操作租户');
      if (!tenants.some((tenant) => tenant.id === id)) return send(null, 404, '租户不存在');
      if (nextFailure) { const status = nextFailure; nextFailure = 0; return send(null, status, '模拟错误'); }
      const existing = credentials.get(id);
      if (req.method === 'GET') return send({ tenant_id: id, generated: !!existing, client_id: existing || '', app_id: existing || '' });
      if (existing && !match[2]) return send(null, 409, '凭据已生成');
      if (!existing && match[2]) return send(null, 400, '请先生成凭据');
      const client = existing || String(id).repeat(32);
      credentials.set(id, client);
      return send({ tenant_id: id, client_id: client, app_id: client, app_secret: (match[2] ? 'b' : 'a').repeat(64) });
    }
    return send({ list: [], count: 0 });
  }
  let file = path.resolve(root, '.' + url.pathname.replace(/^\/admin/, ''));
  if (!file.startsWith(root + path.sep)) file = path.join(root, 'index.html');
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2' };
  res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).on('error', () => res.destroy()).pipe(res);
}).listen(18121, '127.0.0.1', () => console.log('Fixture only: http://127.0.0.1:18121/admin/login'));
