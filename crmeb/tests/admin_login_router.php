<?php
// Real admin controllers/routes with isolated database/cache; no installation initialization or listeners.
require __DIR__ . '/tenant_bootstrap.php';
require dirname(__DIR__) . '/app/common.php';

$app->setNamespace('app\\adminapi');
$app->debug(true);
$app->bind(require dirname(__DIR__) . '/app/adminapi/provider.php');
$app->bind('sysConfig', \crmeb\services\SystemConfigService::class);
$app->config->set(require dirname(__DIR__) . '/config/cookie.php', 'cookie');
$app->config->set(['url_route_must' => true], 'route');
$app->config->set(['default' => 'file', 'stores' => ['file' => [
    'type' => 'File', 'path' => getenv('TENANT_TEST_CACHE') . '/',
]]], 'cache');
$request = new \app\Request();
$request->withServer($_SERVER)->withHeader(array_change_key_case(getallheaders(), CASE_LOWER))
    ->setMethod($_SERVER['REQUEST_METHOD'])->withGet($_GET)
    ->withInput(file_get_contents('php://input'));
$request->setPathinfo(preg_replace('#^/adminapi/#', '', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)));
$app->instance('request', $request);
require dirname(__DIR__) . '/app/adminapi/route/route.php';
require dirname(__DIR__) . '/app/adminapi/route/tenant.php';
require dirname(__DIR__) . '/app/adminapi/route/setting.php';
\think\facade\Route::get('__test/items', function () {
    $model = new class extends \crmeb\basic\BaseModel { protected $name = 'tenant_test_item'; };
    return app('json')->success(['tenant_id' => \crmeb\services\TenantContext::id(),
        'admin_id' => request()->adminId(), 'items' => $model->select()->toArray()]);
})->middleware(\app\adminapi\middleware\AdminAuthTokenMiddleware::class);
try {
    $app->route->dispatch($request)->send();
} finally {
    \crmeb\services\TenantContext::clear();
}
