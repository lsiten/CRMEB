<?php
require __DIR__ . '/tenant_bootstrap.php';

use crmeb\services\CacheService;
use crmeb\services\TenantContext;
use think\facade\Db;

$cachePath = getenv('TENANT_TEST_CACHE');
if (!$cachePath || !is_dir($cachePath)) throw new RuntimeException('Isolated cache directory required');
$app->config->set(['default' => 'file', 'stores' => ['file' => [
    'type' => 'File', 'path' => $cachePath . '/jwt/',
]]], 'cache');
testRequest();
$pdo = new PDO('mysql:host=127.0.0.1;port=' . $port, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE `' . $database . '`');
try {
    Db::execute('CREATE TABLE eb_user (uid INT PRIMARY KEY, tenant_id INT, is_del INT, status INT, last_time INT)');
    Db::name('user')->insert(['uid' => 11, 'tenant_id' => 1, 'is_del' => 0, 'status' => 1, 'last_time' => 0]);
    $jwt = new \crmeb\utils\JwtAuth();
    $auth = new \app\services\user\UserAuthServices(new \app\dao\user\UserAuthDao());
    $api = $jwt->createToken(11, 'api', ['tenant_id' => 1])['token'];
    TenantContext::bindClient(1);
    check($auth->parseToken($api)['user']->uid === 11, 'valid api token authenticates user 11');
    foreach (['admin', 'kefu', 'unknown'] as $type) {
        $token = $jwt->createToken(11, $type, ['tenant_id' => 1])['token'];
        check(CacheService::get(md5($token))['type'] === $type, $type . ' tag does not isolate cache lookup');
        $jwt->parseToken($token);
        $jwt->verifyToken();
        check(true, $type . ' same-tenant JWT signature is valid');
        Db::name('user')->where('uid', 11)->update(['last_time' => 0]);
        denied(fn () => $auth->parseToken($token), 401, $type . ' UID collision must not authenticate user 11');
        check(Db::name('user')->where('uid', 11)->value('last_time') === 0, $type . ' denial never updates user login time');
        check(TenantContext::clientId() === 1, $type . ' denial preserves tenant binding');
        $request = testRequest([], ['authorization' => 'Bearer ' . $token]);
        $middleware = new \app\api\middleware\AuthTokenMiddleware();
        $response = $middleware->handle($request, function () { throw new RuntimeException('Non-api JWT reached protected business'); });
        check($response->getData()['status'] === 401, $type . ' protected API returns 401');
        $middleware->handle($request, function ($request) use ($type) {
            check(!$request->isLogin() && $request->uid() === 0, $type . ' optional API remains anonymous');
            return \think\Response::create('ok');
        }, false);
    }
    TenantContext::bindClient(2);
    denied(fn () => $auth->parseToken($api), 403, 'api token from A still rejected in B');
    echo "All JWT type isolation checks passed.\n";
} finally {
    TenantContext::clear();
    $app->cache->clear();
    $pdo->exec('DROP DATABASE `' . $database . '`');
}
