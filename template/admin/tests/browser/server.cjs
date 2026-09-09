const fs = require('fs');
const path = require('path');
const http = require('http');
const webpack = require('webpack');
const VueLoaderPlugin = require('vue-loader/lib/plugin');
const root = path.resolve(__dirname, '../..');
const output = path.resolve(process.argv[2]);
const port = Number(process.argv[3] || 18431);
fs.mkdirSync(output, { recursive: true });
const resolve = (name) => require.resolve(name);
webpack({
  mode: 'development', devtool: false, context: root,
  entry: path.join(__dirname, 'entry.js'), output: { path: output, filename: 'bundle.js', publicPath: '/' },
  resolve: { extensions: ['.js', '.vue'], symlinks: true, alias: {
    'vue$': resolve('vue/dist/vue.esm.js'),
    '@/router$': path.join(__dirname, 'router.js'), '@/libs/util$': path.join(__dirname, 'util.js'),
    '@/utils$': path.join(__dirname, 'utils.js'), '@/utils/tenant$': path.join(__dirname, 'utils.js'),
    '@': path.join(root, 'src'),
  } },
  resolveLoader: { modules: [path.join(root, 'node_modules'), path.join(root, 'node_modules/.pnpm/node_modules')] },
  module: { rules: [
    { test: /\.vue$/, loader: resolve('vue-loader') },
    { test: /\.css$/, use: [resolve('vue-style-loader'), resolve('css-loader')] },
    { test: /\.scss$/, use: [resolve('vue-style-loader'), resolve('css-loader'), { loader: resolve('sass-loader'), options: { sassOptions: { silenceDeprecations: ['legacy-js-api'] } } }] },
    { test: /\.(png|jpe?g|gif|svg|woff2?|ttf|eot)$/, loader: resolve('file-loader'), options: { name: '[hash].[ext]' } },
  ] }, plugins: [new VueLoaderPlugin()],
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({ all: false, errors: true })); process.exitCode = 1; return; }
  let records = [], next = {}, waiting = [];
  const json = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    if (req.url === '/__events') return json(res, records);
    if (req.url === '/__control') {
      const control = JSON.parse(body || '{}');
      if (control.reset) records = [];
      if (control.next) next = control.next;
      if (control.release) { waiting.forEach((send) => send()); waiting = []; }
      return json(res, { ok: true });
    }
    if (/^\/(kefuapi|adminapi)\//.test(req.url)) {
      records.push({ url: req.url, method: req.method, appid: req.headers.appid || null,
        secret: req.headers.screct_id || null, bearer: req.headers['authori-zation'] || null,
        contentType: req.headers['content-type'], body });
      const route = req.url.split('?')[0];
      let data = {};
      if (route.endsWith('/adv')) data = { content: '隔离 HTTP 请求测试' };
      if (route.endsWith('/feedback')) data = { feedback: '请留下反馈内容' };
      if (route.endsWith('/user')) data = { uid: 1, tourist_uid: 11, nickname: '测试客服', avatar: '' };
      if (route.endsWith('/chat')) data = [];
      if (route.endsWith('/upload')) data = { url: '/pixel.png' };
      if (route.endsWith('/config')) data = { version: '测试', copyright: '隔离客服登录回归' };
      if (route.endsWith('/login')) data = { token: 'test-staff-token', exp_time: Math.floor(Date.now()/1000)+3600, kefuInfo: { uid: 91 } };
      const rule = next[route]; if (rule) delete next[route];
      const send = () => json(res, rule && rule.response || { status: 200, msg: '成功', data }, rule && rule.http || 200);
      if (rule && rule.delay) waiting.push(send); else send();
      return;
    }
    if (req.url === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>客服隔离验证</title><script defer src="/bundle.js"></script><body></body></html>'); return; }
    if (req.url.startsWith('/admin/') || req.url.startsWith('/kefu')) {
      const relative = req.url.slice('/admin/'.length).split('?')[0];
      const file = relative.startsWith('system_static/') ? relative : 'index.html';
      const target = path.resolve(root, 'dist', file);
      if (!target.startsWith(path.resolve(root, 'dist') + path.sep) || !fs.existsSync(target)) {
        res.statusCode = 404; res.end(); return;
      }
      const mime = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream';
      res.setHeader('Content-Type', mime + '; charset=utf-8');
      fs.createReadStream(target).pipe(res); return;
    }
    const target = path.join(output, path.basename(req.url));
    if (fs.existsSync(target)) { res.setHeader('Content-Type', req.url.endsWith('.js') ? 'application/javascript; charset=utf-8' : 'application/octet-stream'); fs.createReadStream(target).pipe(res); } else { res.statusCode = 404; res.end(); }
  });
  server.listen(port, '127.0.0.1', () => console.log(`READY ${port} PID ${process.pid}`));
  process.on('SIGTERM', () => server.close(() => process.exit(0)));
});
