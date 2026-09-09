<?php
require dirname(__DIR__) . '/vendor/autoload.php';
require dirname(__DIR__) . '/vendor/topthink/framework/src/helper.php';
function getLang($message, array $replace = []) { throw new RuntimeException('Authentication must not read language data'); }
$app = new think\App(dirname(__DIR__) . '/');
think\Container::setInstance($app);
$app->instance('json', new crmeb\utils\Json());
$gate = new app\api\middleware\TenantTokenMiddleware();
$calls = 0;
$next = function () use (&$calls) { ++$calls; return json(['status' => 200]); };
$cases = [
    'missing headers' => [],
    'only appid' => ['appid' => str_repeat('a', 32)],
    'only secret' => ['screct_id' => str_repeat('b', 64)],
    'legacy tenant token' => ['x-tenant-token' => 'legacy'],
    'user bearer alone' => ['authorization' => 'Bearer legacy'],
];
foreach ($cases as $name => $headers) {
    $request = (new app\Request())->withHeader($headers)->setMethod('GET');
    $app->instance('request', $request);
    $before = $calls;
    $result = $gate->handle($request, $next)->getData();
    if ($calls !== $before || ($result['data']['code'] ?? '') !== 'tenant_auth_required') {
        throw new RuntimeException('FAIL ' . $name . ': business reached or wrong error');
    }
    if (crmeb\services\TenantContext::clientId() !== null) throw new RuntimeException('Context leaked');
    echo 'PASS ' . $name . PHP_EOL;
}
$request = (new app\Request())->withHeader(['appid' => 'malformed', 'screct_id' => 'malformed'])->setMethod('GET');
$app->instance('request', $request);
$result = $gate->handle($request, $next)->getData();
if (($result['data']['code'] ?? '') !== 'tenant_credentials_invalid') throw new RuntimeException('Invalid credentials attempted language data access');
echo "PASS malformed credentials avoid language data\n";
