<?php

// Only the regression runner sets this directory; never expose this router publicly.
$directory = getenv('CRMEB_REFUND_FIXTURE');
if (!$directory || (!is_file($directory . '/fixture.sqlite') && !is_file($directory . '/mysql.json'))) {
    http_response_code(503);
    exit;
}
require __DIR__ . '/refund_fixture.php';
$app = refundApp($directory);
$request = app\Request::__make($app);
$request->setPathinfo(ltrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/'));
$app->instance('request', $request);
$app->bind(think\Request::class, app\Request::class);
$app->instance(app\Request::class, $request);
$app->bind(think\exception\Handle::class, app\api\ApiExceptionHandle::class);
$app->setNamespace('app\\api');
$app->config->set(['header' => []], 'cookie');
$app->config->set(require dirname(__DIR__) . '/app/api/config/route.php', 'route');
// Load the production v1 route definitions, including their real auth middleware.
think\facade\Route::group('api', function () {
    require dirname(__DIR__) . '/app/api/route/v1.php';
});
try {
    $response = $app->route->dispatch($request);
} catch (Throwable $e) {
    $response = (new app\api\ApiExceptionHandle($app))->render($request, $e);
}
$response->send();
