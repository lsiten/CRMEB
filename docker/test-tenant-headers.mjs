import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync} from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(path.join(os.tmpdir(), 'crmeb-header-test-'));
const nginx = process.env.HEADER_TEST_NGINX || 'nginx';
const php = process.env.HEADER_TEST_PHP_FPM || 'php-fpm';
const fastcgi = process.env.HEADER_TEST_FASTCGI_PARAMS || '/etc/nginx/fastcgi_params';
const processes = [];
let assertions = 0;
let proxyReceiver;
const appid = 'gateway-fixture-app';
const secret = 'gateway-fixture-secret';

function check(value, message) {
    assert.ok(value, message);
    assertions++;
}
async function freePort() {
    const server = net.createServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}
function launch(command, args) {
    const child = spawn(command, args, {stdio: ['ignore', 'pipe', 'pipe']});
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', error => { child.startupError = error; output += error.message; });
    processes.push(child);
    child.diagnostics = () => output;
    return child;
}
async function ready(port, child) {
    for (let i = 0; i < 100; i++) {
        if (child.startupError || child.exitCode !== null) throw new Error(child.diagnostics());
        const connected = await new Promise(resolve => {
            const socket = net.connect(port, '127.0.0.1');
            socket.once('connect', () => { socket.destroy(); resolve(true); });
            socket.once('error', () => resolve(false));
        });
        if (connected) return;
        await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error(`Listener timeout: ${child.diagnostics()}`);
}
function request(port, headers = [], url = '/api/probe', method = 'GET', body = '') {
    return new Promise((resolve, reject) => {
        const req = http.request({hostname: '127.0.0.1', port, path: url, method,
            headers: ['Host', 'localhost', 'Connection', 'close', ...headers]}, res => {
            let text = '';
            res.on('data', data => { text += data; });
            res.on('end', () => resolve({status: res.statusCode, headers: res.headers,
                rawHeaders: res.rawHeaders, text}));
        });
        req.setTimeout(3000, () => req.destroy(new Error('request timeout')));
        req.on('error', reject);
        req.end(body);
    });
}
async function stop(child) {
    if (!child.pid || child.exitCode !== null) return;
    const ended = new Promise(resolve => child.once('exit', resolve));
    child.kill('SIGTERM');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 3000);
    await ended;
    clearTimeout(timeout);
}

try {
    mkdirSync(path.join(scratch, 'public'));
    writeFileSync(path.join(scratch, 'public/index.php'), `<?php
// Transport receiver only: no CRMEB authentication, database or real credentials.
header('Content-Type: application/json');
header('Cache-Control: no-store');
header('Access-Control-Allow-Origin: https://fixture.invalid');
header('Access-Control-Allow-Headers: appid,screct_id,Authori-zation,Content-Type');
header('Access-Control-Allow-Methods: GET,POST,OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
$app = $_SERVER['HTTP_APPID'] ?? '';
$secret = $_SERVER['HTTP_SCRECT_ID'] ?? '';
$status = 200; $code = 'receiver_ok';
if ($app === '' || $secret === '') { $status = 401; $code = 'tenant_auth_required'; }
elseif ($app !== '${appid}' || $secret !== '${secret}') {
    $status = 401; $code = 'tenant_credentials_invalid';
}
elseif (strpos($_SERVER['REQUEST_URI'], '/unavailable') !== false) {
    $status = 503; $code = 'tenant_auth_unavailable'; http_response_code(503);
}
elseif (strpos($_SERVER['REQUEST_URI'], '/mismatch') !== false) {
    $status = 403; $code = 'tenant_mismatch'; http_response_code(403);
}
echo json_encode(['status' => $status, 'msg' => 'fixture', 'data' => ['code' => $code,
    'auth_preserved' => ($_SERVER['HTTP_AUTHORI_ZATION'] ?? '') === 'Bearer fixture',
    'body_preserved' => file_get_contents('php://input') === '{"probe":true}']]);
`);
    const fpmPort = await freePort();
    writeFileSync(path.join(scratch, 'fpm.conf'), `[global]
daemonize = no
error_log = ${scratch}/fpm.log
[fixture]
listen = 127.0.0.1:${fpmPort}
pm = static
pm.max_children = 1
catch_workers_output = yes
`);
    const fpm = launch(php, ['-F', '-y', path.join(scratch, 'fpm.conf')]);
    await ready(fpmPort, fpm);
    proxyReceiver = http.createServer((req, res) => {
        const names = req.rawHeaders.filter((_, i) => i % 2 === 0).map(name => name.toLowerCase());
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
            valid: req.headers.appid === appid && req.headers.screct_id === secret,
            invalid: req.headers.screct_id === ',',
            canonicalOnce: names.filter(name => name === 'screct_id').length === 1,
            noVariant: !names.includes('screct-id'),
        }));
    });
    await new Promise(resolve => proxyReceiver.listen(0, '127.0.0.1', resolve));
    const proxyPort = proxyReceiver.address().port;
    for (const relative of ['docker/nginx.conf', 'help/docker/nginx/vhost.conf']) {
        const port = await freePort();
        const configSource = process.env.HEADER_TEST_BASELINE
            ? spawnSync('git', ['show', `origin/master:${relative}`], {cwd: repo, encoding: 'utf8'})
            : null;
        if (configSource) assert.equal(configSource.status, 0, configSource.stderr);
        let server = configSource ? configSource.stdout : readFileSync(path.join(repo, relative), 'utf8');
        if (process.env.HEADER_TEST_BASELINE === 'underscores') {
            server = server.replace('server {', 'server {\n    underscores_in_headers on;');
        }
        server = server.replace(/listen 80(?: default_server)?;/, `listen 127.0.0.1:${port};`)
            .replace(/root \/var\/www(?:\/crmeb)?\/public;/, `root ${scratch}/public;`)
            .replace(/fastcgi_pass (?:127\.0\.0\.1|phpfpm):9000;/, `fastcgi_pass 127.0.0.1:${fpmPort};`)
            .replace(/http:\/\/(?:127\.0\.0\.1|192\.168\.10\.90):4000[12]\//g, `http://127.0.0.1:${proxyPort}/`)
            .replace('include fastcgi_params;', `include ${fastcgi};`)
            .replaceAll('/etc/nginx/tenant-headers.js', path.join(repo, 'docker/tenant-headers.js'))
            .replaceAll('/var/log/nginx/access.log', `${scratch}/access.log`)
            .replaceAll('/var/log/nginx/error.log', `${scratch}/error.log`);
        const module = process.env.HEADER_TEST_NJS_MODULE;
        writeFileSync(path.join(scratch, 'nginx.conf'), `${module ? `load_module ${module};` : ''}
daemon off;
pid ${scratch}/nginx.pid;
error_log ${scratch}/error.log warn;
events {}
http {
    access_log ${scratch}/access.log;
    client_body_temp_path ${scratch}/body;
    fastcgi_temp_path ${scratch}/fastcgi;
    proxy_temp_path ${scratch}/proxy;
    ${server}
}
`);
        const checked = spawnSync(nginx, ['-t', '-p', `${scratch}/`, '-c', `${scratch}/nginx.conf`], {encoding: 'utf8'});
        assert.equal(checked.status, 0, checked.stderr);
        const gateway = launch(nginx, ['-p', `${scratch}/`, '-c', `${scratch}/nginx.conf`]);
        await ready(port, gateway);
        const valid = ['appid', appid, 'screct_id', secret];
        const cases = [
            ['canonical', valid, 'receiver_ok'],
            ['case-insensitive', ['APPID', appid, 'ScReCt_Id', secret], 'receiver_ok'],
            ['missing both', [], 'tenant_auth_required'],
            ['missing secret', ['appid', appid], 'tenant_auth_required'],
            ['missing appid', ['screct_id', secret], 'tenant_auth_required'],
            ['wrong secret', ['appid', appid, 'screct_id', 'wrong'], 'tenant_credentials_invalid'],
            ['hyphen only', ['appid', appid, 'screct-id', secret], 'tenant_credentials_invalid'],
            ['hyphen after', [...valid, 'screct-id', 'wrong'], 'tenant_credentials_invalid'],
            ['hyphen before', ['screct-id', 'wrong', ...valid], 'tenant_credentials_invalid'],
            ['same variant values', [...valid, 'screct-id', secret], 'tenant_credentials_invalid'],
            ['duplicate secret', [...valid, 'SCRECT_ID', secret], 'tenant_credentials_invalid'],
            ['duplicate appid', [...valid, 'Appid', appid], 'tenant_credentials_invalid'],
            ['empty duplicate', [...valid, 'screct_id', ''], 'tenant_credentials_invalid'],
            ['comma combined', ['appid', appid, 'screct_id', `${secret},${secret}`], 'tenant_credentials_invalid'],
            ['old token only', ['X-Tenant-Token', 'fixture'], 'tenant_auth_required'],
        ];
        for (const [name, headers, code] of cases) {
            const response = await request(port, headers);
            check(JSON.parse(response.text).data.code === code, `${relative}: ${name}`);
            check(response.status === 200, `${name}: HTTP status preserved`);
            check(response.headers['cache-control'] === 'no-store', `${name}: no-store`);
            check(response.rawHeaders.filter(h => h.toLowerCase() === 'access-control-allow-origin').length === 1,
                `${name}: single CORS header`);
        }
        const queryOnly = await request(port, [], '/api/probe?appid=fixture&screct_id=fixture');
        check(JSON.parse(queryOnly.text).data.code === 'tenant_auth_required', 'query does not become headers');
        const posted = await request(port, [...valid, 'Authori-zation', 'Bearer fixture',
            'Content-Type', 'application/json', 'Content-Length', '14'], '/api/probe', 'POST', '{"probe":true}');
        const data = JSON.parse(posted.text).data;
        check(data.auth_preserved && data.body_preserved, 'user auth and body unchanged');
        for (const [url, status, code] of [['/api/unavailable', 503, 'tenant_auth_unavailable'],
            ['/api/mismatch', 403, 'tenant_mismatch']]) {
            const response = await request(port, valid, url);
            check(response.status === status && JSON.parse(response.text).data.code === code, 'upstream error preserved');
            check(response.headers['cache-control'] === 'no-store', 'error not cached');
            check(response.headers['access-control-allow-origin'] === 'https://fixture.invalid', 'error CORS preserved');
        }
        const preflight = await request(port, ['Origin', 'https://fixture.invalid',
            'Access-Control-Request-Method', 'POST', 'Access-Control-Request-Headers', 'appid,screct_id'], '/api/probe', 'OPTIONS');
        check(preflight.status === 204 && preflight.text === '', 'preflight unchanged and no business body');
        check(preflight.headers['access-control-allow-headers'].includes('screct_id'), 'preflight allowed headers');
        for (const url of ['/notice/probe', '/msg/probe']) {
            const normal = JSON.parse((await request(port, valid, url)).text);
            check(normal.valid && normal.canonicalOnce && normal.noVariant, 'proxy preserves single canonical header');
            for (const headers of [[...valid, 'screct-id', secret], ['screct-id', secret, ...valid],
                [...valid, 'SCRECT_ID', secret]]) {
                const invalid = JSON.parse((await request(port, headers, url)).text);
                check(invalid.invalid && invalid.canonicalOnce && invalid.noVariant, 'proxy removes conflicting raw heads');
            }
        }
        const missing = await request(port, valid, '/missing.php');
        check([404, 403].includes(missing.status), 'missing PHP file stays denied');
        await stop(gateway);
        const logs = readFileSync(`${scratch}/access.log`, 'utf8') + readFileSync(`${scratch}/error.log`, 'utf8');
        check(!logs.includes(appid) && !logs.includes(secret), 'credential header values absent in gateway logs');
        check(!logs.includes('?appid='), 'query omitted in gateway access logs');
        console.log(`PASS ${relative}`);
    }
    console.log(`PASS ${assertions} transport assertions; receiver only, no tenant authentication or Docker validation`);
} finally {
    for (const child of processes.reverse()) await stop(child);
    if (proxyReceiver) await new Promise(resolve => proxyReceiver.close(resolve));
    rmSync(scratch, {recursive: true, force: true});
}
