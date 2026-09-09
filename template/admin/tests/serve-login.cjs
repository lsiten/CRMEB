const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { once } = require('node:events');

async function freePort() {
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1');
  await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}
async function main() {
  const root = process.env.ADMIN_LOGIN_SERVER;
  if (!root || execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() !==
      'eeba816734253d0d11b9d8324429bfcaa9b2a6ae') throw new Error('Exact server checkout required');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-login-ui-'));
  fs.mkdirSync(path.join(scratch, 'db'));
  fs.mkdirSync(path.join(scratch, 'cache'));
  const port = await freePort();
  const mysql = process.env.TENANT_TEST_MYSQLD || '/opt/homebrew/bin/mysqld';
  const php = process.env.TENANT_TEST_PHP || '/opt/homebrew/opt/php@7.4/bin/php';
  let database;
  let driver;
  let driverExited = false;
  let proxy;
  try {
    execFileSync(mysql, ['--no-defaults', '--initialize-insecure', `--datadir=${scratch}/db`], { stdio: 'ignore' });
    database = spawn(mysql, ['--no-defaults', `--datadir=${scratch}/db`, '--bind-address=127.0.0.1',
      `--port=${port}`, `--socket=${scratch}/mysql.sock`, '--mysqlx=OFF', '--skip-log-bin'], { stdio: 'ignore' });
    const env = { ...process.env, TENANT_TEST_PORT: String(port), TENANT_TEST_DATABASE: `lsit21_test_${port}`,
      TENANT_TEST_CACHE: `${scratch}/cache` };
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try {
        execFileSync(php, ['-r', 'new PDO("mysql:host=127.0.0.1;port=".$argv[1],"root","");', String(port)], { stdio: 'ignore' });
        ready = true; break;
      } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
    }
    if (!ready) throw new Error('Isolated MySQL did not start');
    driver = spawn(php, [path.join(__dirname, 'serve-login.php')], { env, stdio: ['pipe', 'pipe', 'inherit'] });
    driver.once('exit', () => { driverExited = true; });
    let output = '';
    const info = await new Promise((resolve, reject) => {
      driver.once('exit', (code) => reject(new Error(`driver exited ${code}`)));
      driver.stdout.on('data', (chunk) => {
        output += chunk;
        if (output.includes('\n')) {
          try { resolve(JSON.parse(output.trim())); } catch (error) { reject(error); }
        }
      });
    });
    proxy = http.createServer((req, res) => {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname.startsWith('/adminapi/')) {
        const endpoint = pathname.slice('/adminapi/'.length);
        if (endpoint === 'login/info') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 200, data: { site_name: '隔离登录联调', login_captcha: 0, slide: [] } }));
          return;
        }
        const target = new URL(req.url, info.base);
        const forward = http.request(target, { method: req.method, headers: req.headers }, (upstream) => {
          res.writeHead(upstream.statusCode, upstream.headers);
          upstream.pipe(res);
        });
        forward.on('error', () => { res.statusCode = 502; res.end('Test server unavailable'); });
        req.pipe(forward);
        return;
      }
      const dist = path.resolve(__dirname, '../dist');
      const relative = decodeURIComponent(pathname.replace(/^\/admin\/?/, ''));
      let file = path.resolve(dist, relative);
      if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
      fs.createReadStream(file).pipe(res);
    });
    proxy.listen(0, '127.0.0.1');
    await once(proxy, 'listening');
    const details = { url: `http://127.0.0.1:${proxy.address().port}/admin/login`, password: info.password,
      mysqlPid: database.pid, driverPid: driver.pid, scratch };
    fs.writeFileSync(path.join(__dirname, 'login-ready.json'), JSON.stringify(details), { mode: 0o600 });
    console.log(`READY ${details.url}; Enter to stop isolated services`);
    await Promise.race([once(process.stdin, 'data'), once(process, 'SIGTERM'), once(process, 'SIGINT')]);
  } finally {
    process.stdin.pause();
    if (proxy) await new Promise((resolve) => proxy.close(resolve));
    if (driver && !driverExited) {
      fs.writeFileSync(path.join(scratch, 'cache/stop'), '');
      await once(driver, 'exit');
    }
    if (database && database.exitCode === null) { database.kill('SIGTERM'); await once(database, 'exit'); }
    fs.rmSync(scratch, { recursive: true, force: true });
    fs.rmSync(path.join(__dirname, 'login-ready.json'), { force: true });
    console.log('CLEANED isolated database, cache, HTTP and proxy');
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
