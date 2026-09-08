<?php
// Isolated HTTP harness: load real API routes and middleware without installed app initialization.
require __DIR__ . '/tenant_bootstrap.php';

$app->setNamespace('app\\api');
$app->config->set(require dirname(__DIR__) . '/config/cookie.php', 'cookie');
$app->config->set(['url_route_must' => true], 'route');
$app->config->set(['entries' => json_decode(file_get_contents(getenv('TENANT_TEST_ENTRY_CONFIG')), true)], 'tenant_bootstrap');
$app->config->set(['default' => 'file', 'stores' => ['file' => [
    'type' => 'File', 'path' => getenv('TENANT_TEST_CACHE') . '/',
]]], 'cache');
$request = new \app\Request();
$request->withServer($_SERVER)->withHeader(array_change_key_case(getallheaders(), CASE_LOWER))
    ->setMethod($_SERVER['REQUEST_METHOD'])->withGet($_GET)
    ->withInput(file_get_contents('php://input'));
$request->setPathinfo(preg_replace('#^/api/#', '', parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)));
$app->instance('request', $request);
require dirname(__DIR__) . '/app/api/route/v1.php';
\think\facade\Route::get('__test/items', function () {
    $model = new class extends \crmeb\basic\BaseModel { protected $name = 'tenant_test_item'; };
    return app('json')->success(['tenant_id' => \crmeb\services\TenantContext::id(), 'items' => $model->select()->toArray()]);
});
\think\facade\Route::get('__test/user', function () {
    return app('json')->success(['uid' => request()->uid()]);
})->middleware(\app\api\middleware\AuthTokenMiddleware::class);
$pipeline = function ($request) use ($app) { return $app->route->dispatch($request); };
foreach (array_reverse(require dirname(__DIR__) . '/app/api/middleware.php') as $class) {
    $next = $pipeline;
    $pipeline = function ($request) use ($class, $next) { return (new $class())->handle($request, $next); };
}
try {
    $pipeline($request)->send();
} catch (\think\exception\HttpException $e) {
    \think\Response::create(['status' => $e->getStatusCode()], 'json', $e->getStatusCode())->send();
}
