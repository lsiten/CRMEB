<?php
require __DIR__ . '/tenant_bootstrap.php';

use app\services\system\TenantCredentialServices;
use crmeb\services\TenantContext;
use crmeb\services\TenantAccess;
use think\facade\Db;

$pdo = new PDO('mysql:host=127.0.0.1;port=' . $port, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
// CREATE without IF NOT EXISTS prevents accidentally reusing another test's data.
$pdo->exec('CREATE DATABASE `' . $database . '`');
try {
    Db::execute('CREATE TABLE eb_tenant (id INT UNSIGNED PRIMARY KEY, name VARCHAR(100), code VARCHAR(64), status INT, add_time INT DEFAULT 0) ENGINE=InnoDB');
    Db::execute(file_get_contents(dirname(__DIR__) . '/upgrade/tenant_credentials.sql'));
    Db::name('tenant')->insertAll([
        ['id' => 1, 'name' => 'A', 'code' => 'a', 'status' => 1],
        ['id' => 2, 'name' => 'B', 'code' => 'b', 'status' => 1],
        ['id' => 3, 'name' => 'Concurrent', 'code' => 'c', 'status' => 1],
    ]);
    $a = ['level' => 1, 'tenant_id' => 1];
    $b = ['level' => 1, 'tenant_id' => 2];
    $super = ['level' => 0, 'tenant_id' => 1];
    $service = new TenantCredentialServices();
    check(!$service->info($a, 1)['generated'], 'initial state');
    denied(fn () => $service->info($a, 2), 403, 'A cannot read B credentials');
    denied(fn () => $service->generate($b, 1), 403, 'B cannot create A credentials');
    $first = $service->generate($a, 1);
    $second = $service->generate($super, 2);
    check($first['client_id'] === $first['app_id'], 'client_id/app_id alias');
    check($first['client_id'] !== $second['client_id'], 'unique client identifiers');
    check($service->info($super, 2)['generated'], 'super administrator reads B');
    check(!isset($service->info($a, 1)['app_secret']), 'read never reveals secret');
    check(Db::name('tenant_credential')->where('tenant_id', 1)->value('secret_hash') !== $first['app_secret'], 'no plaintext storage');
    denied(fn () => $service->generate($a, 1), 409, 'repeat generation rejected');
    denied(fn () => $service->generate($a, 2, true), 403, 'A cannot reset B');
    denied(fn () => $service->generate($super, 99), 404, 'missing tenant');
    $tokenA = $service->exchange(['app_id' => $first['app_id'], 'app_secret' => $first['app_secret']]);
    $tokenB = $service->exchange($second);
    check($service->resolve($tokenA['tenant_token']) === 1, 'A token resolves tenant A');
    check($service->resolve($tokenB['tenant_token']) === 2, 'B token resolves tenant B');
    denied(fn () => $service->exchange(['client_id' => $first['client_id'], 'app_id' => $second['app_id'], 'app_secret' => $first['app_secret']]), 400, 'conflicting aliases rejected');
    denied(fn () => $service->exchange(['client_id' => $first['client_id'], 'app_secret' => $second['app_secret']]), 401, 'cross-tenant credential pair rejected');
    denied(fn () => $service->resolve($tokenA['tenant_token'] . '0'), 401, 'tampered token rejected');
    $row = Db::name('tenant_credential')->where('tenant_id', 1)->find();
    $expired = $first['client_id'] . '.' . (time() - 1) . '.' . str_repeat('0', 32);
    denied(fn () => $service->resolve($expired . '.' . hash_hmac('sha256', $expired, $row['secret_hash'])), 401, 'expired signed token rejected');

    $middleware = new \app\api\middleware\TenantTokenMiddleware();
    $req = testRequest([], ['appid' => $second['client_id'], 'screct_id' => $second['app_secret']]);
    $req->withGet(['tenant_id' => 1]);
    $response = $middleware->handle($req, function () { throw new RuntimeException('Conflicting tenant reached business'); });
    check($response->getData()['status'] === 403, 'explicit tenant conflict rejected');
    $reached = false;
    $middleware->handle(testRequest([], ['appid' => $second['client_id'], 'screct_id' => $second['app_secret']]), function () use (&$reached) {
        $reached = true;
        check(TenantContext::id() === 2 && TenantContext::clientId() === 2, 'middleware binds B from headers');
        return \think\Response::create('ok');
    });
    check($reached, 'valid headers reach business');
    check(TenantContext::id() === 1 && TenantContext::clientId() === null, 'context cleared after request');
    $response = $middleware->handle(testRequest([], ['x-tenant-token' => 'invalid']), function () { throw new RuntimeException('Invalid token reached business'); });
    check($response->getData()['status'] === 401, 'invalid explicit token cannot fall back');
    $app->config->set(require dirname(__DIR__) . '/config/cookie.php', 'cookie');
    $pipeline = function () { throw new RuntimeException('Invalid token reached route'); };
    foreach (array_reverse(require dirname(__DIR__) . '/app/api/middleware.php') as $class) {
        $next = $pipeline;
        $pipeline = function ($request) use ($class, $next) { return (new $class())->handle($request, $next); };
    }
    $response = $pipeline(testRequest([], ['x-tenant-token' => 'invalid', 'origin' => 'https://tenant-client.example']));
    check($response->getHeader('Access-Control-Allow-Origin') === 'https://tenant-client.example', 'invalid tenant token retains CORS error response');
    $response = $middleware->handle(testRequest(), function () { throw new RuntimeException('Anonymous request reached business'); });
    check($response->getData()['data']['code'] === 'tenant_auth_required', 'legacy anonymous default removed');

    testRequest($a);
    $controller = new \app\adminapi\controller\v1\setting\Tenant(new \think\facade\App());
    check($controller->adminList()->getData()['status'] === 403, 'tenant admin cannot list tenants');
    check($controller->switchTenant()->getData()['status'] === 403, 'tenant admin cannot switch');
    check($controller->create()->getData()['status'] === 403, 'tenant admin cannot create tenant');
    check($controller->update(2)->getData()['status'] === 403, 'tenant admin cannot edit B');
    check($controller->delete(2)->getData()['status'] === 403, 'tenant admin cannot delete B');
    check($controller->setStatus(2, 0)->getData()['status'] === 403, 'tenant admin cannot disable B');
    $credentialController = new \app\adminapi\controller\v1\setting\TenantCredential(new \think\facade\App());
    check($credentialController->read(2)->getData()['status'] === 403, 'HTTP controller rejects credential IDOR');
    check($credentialController->read(1)->getData()['status'] === 200, 'HTTP controller permits own credentials');
    testRequest($super);
    $superController = new \app\adminapi\controller\v1\setting\Tenant(new \think\facade\App());
    check(count($superController->adminList()->getData()['data']['list']) === 3, 'super administrator lists all tenants');

    testRequest();
    $jwt = new \crmeb\utils\JwtAuth();
    $userToken = $jwt->getToken(11, 'api', ['tenant_id' => 1])['token'];
    $cache = new class($userToken) {
        private $token;
        public function __construct(string $token) { $this->token = $token; }
        public function get(string $key) { return $key === md5($this->token) ? ['uid' => 11] : null; }
    };
    $app->instance('think\Cache', $cache);
    $auth = new \app\services\user\UserAuthServices(new \app\dao\user\UserAuthDao());
    TenantContext::bindClient(2);
    denied(fn () => $auth->parseToken($userToken), 403, 'real signed user A token rejected in tenant B');
    check(TenantContext::id() === 2, 'user mismatch preserves bound tenant');
    $request = testRequest([], ['authorization' => 'Bearer ' . $userToken]);
    $response = (new \app\api\middleware\AuthTokenMiddleware())->handle($request, function () { throw new RuntimeException('Mismatch reached public business'); }, false);
    check($response->getData()['status'] === 403, 'optional login cannot swallow tenant mismatch');
    $request = testRequest();
    (new \app\api\middleware\AuthTokenMiddleware())->handle($request, function () {
        check(TenantContext::id() === 2, 'anonymous optional login preserves tenant B');
        return \think\Response::create('ok');
    }, false);
    TenantContext::clear();

    $menus = [['id' => 1, 'pid' => 0, 'menu_path' => '/admin/system/tenant'],
        ['id' => 2, 'pid' => 1, 'menu_path' => '/admin/hidden'], ['id' => 3, 'pid' => 0, 'menu_path' => '/admin/product']];
    check(count(TenantAccess::menus($menus, 1)) === 1, 'tenant menu and descendants removed');
    check(count(TenantAccess::menus($menus, 0)) === 3, 'super administrator retains tenant menu');

    Db::execute('CREATE TABLE eb_tenant_test_item (id INT PRIMARY KEY, tenant_id INT, name VARCHAR(20))');
    Db::name('tenant_test_item')->insertAll([['id' => 1, 'tenant_id' => 1, 'name' => 'A'], ['id' => 2, 'tenant_id' => 2, 'name' => 'B']]);
    $model = new class extends \crmeb\basic\BaseModel { protected $name = 'tenant_test_item'; };
    TenantContext::set(1);
    check($model->where('id', 2)->find() === null, 'A model read cannot access B row');
    check($model->where('id', 2)->update(['name' => 'bad']) === 0, 'A model update cannot modify B row');
    TenantContext::set(2);
    check($model->where('id', 1)->find() === null, 'B model read cannot access A row');
    check($model->where('id', 2)->value('name') === 'B', 'B row unchanged');
    TenantContext::clear();

    $reset = $service->generate($super, 1, true);
    check($reset['client_id'] === $first['client_id'] && $reset['app_secret'] !== $first['app_secret'], 'super reset preserves ID and replaces secret');
    denied(fn () => $service->exchange($first), 401, 'old secret revoked');
    denied(fn () => $service->resolve($tokenA['tenant_token']), 401, 'old token revoked');
    check($service->resolve($service->exchange($reset)['tenant_token']) === 1, 'new credentials work');
    Db::name('tenant')->where('id', 2)->update(['status' => 0]);
    denied(fn () => $service->exchange($second), 401, 'disabled tenant exchange denied');
    denied(fn () => $service->resolve($tokenB['tenant_token']), 401, 'disabled tenant token denied');

    $workers = [];
    for ($i = 0; $i < 8; $i++) {
        $process = proc_open([PHP_BINARY, __DIR__ . '/tenant_concurrent_worker.php'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $workers[] = [$process, $pipes];
    }
    $created = 0;
    $workerErrors = [];
    foreach ($workers as [$process, $pipes]) {
        $out = stream_get_contents($pipes[1]);
        $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        if (proc_close($process) !== 0) { $workerErrors[] = $err; continue; }
        if ($out === 'CREATED') $created++;
        elseif ($out !== 'CONFLICT') $workerErrors[] = 'Unexpected worker output';
    }
    if ($workerErrors) throw new RuntimeException('Concurrent worker failed: ' . $workerErrors[0]);
    check($created === 1 && Db::name('tenant_credential')->where('tenant_id', 3)->count() === 1, '8 concurrent requests create exactly one credential');
    echo "All tenant integration checks passed.\n";
} finally {
    $pdo->exec('DROP DATABASE `' . $database . '`');
}
