<?php
// Deliberately bypass application initialization: never read installation .env or connect to its services.
require dirname(__DIR__) . '/vendor/autoload.php';
require dirname(__DIR__) . '/vendor/topthink/framework/src/helper.php';
function getLang($message, array $replace = []) { return $message; }

$app = new \think\App(dirname(__DIR__) . '/');
\think\Container::setInstance($app);
$database = getenv('TENANT_TEST_DATABASE') ?: '';
if (!preg_match('/^lsit21_test_[a-f0-9]+$/D', $database)) throw new RuntimeException('Isolated test database required');
$port = (int)(getenv('TENANT_TEST_PORT') ?: 43367);
if ($port === 3306 || $port <= 1024) throw new RuntimeException('Dedicated test port required');
$config = ['default' => 'mysql', 'connections' => ['mysql' => [
    'type' => 'mysql', 'hostname' => '127.0.0.1', 'hostport' => $port,
    'database' => $database, 'username' => 'root', 'password' => '', 'prefix' => 'eb_',
    'charset' => 'utf8mb4', 'fields_strict' => true, 'debug' => false,
]]];
$db = new \think\DbManager();
$db->setConfig($config);
$app->instance('think\DbManager', $db);
$app->config->set($config, 'database');
$app->instance('json', new \crmeb\utils\Json());

function check(bool $condition, string $label): void
{
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    echo 'PASS: ' . $label . PHP_EOL;
}

function denied(callable $call, int $status, string $label): void
{
    try { $call(); } catch (\crmeb\exceptions\AuthException $e) {
        check($e->getCode() === $status, $label);
        return;
    }
    throw new RuntimeException('FAIL: expected denial: ' . $label);
}

function testRequest(array $admin = [], array $header = []): \app\Request
{
    $request = new \app\Request();
    $request->withHeader($header)->setMethod('GET');
    $request->macro('adminInfo', function () use ($admin) { return $admin; });
    app()->instance('request', $request);
    return $request;
}
