<?php
require __DIR__ . '/tenant_bootstrap.php';

use app\services\system\TenantCredentialServices;
use think\facade\Db;

function httpCall(string $base, string $path, ?array $body = null, array $headers = []): array
{
    $curl = curl_init($base . $path);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json', 'Origin: https://public-client.example'], $headers),
        CURLOPT_HEADER => true]);
    if ($body !== null) curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body)]);
    $raw = curl_exec($curl);
    if ($raw === false) throw new RuntimeException(curl_error($curl));
    $headerSize = curl_getinfo($curl, CURLINFO_HEADER_SIZE);
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    $data = json_decode(substr($raw, $headerSize), true);
    if (!is_array($data)) throw new RuntimeException('Non-JSON HTTP response: ' . substr($raw, 0, 1200));
    return [$data, substr($raw, 0, $headerSize), $status];
}

$pdo = new PDO('mysql:host=127.0.0.1;port=' . $port, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$server = null;
if (getenv('TENANT_TEST_INTERACTIVE') === '1') {
    if (!function_exists('pcntl_async_signals')) throw new RuntimeException('Interactive mode requires pcntl');
    pcntl_async_signals(true);
    foreach ([SIGINT, SIGTERM] as $signal) pcntl_signal($signal, function () { throw new RuntimeException('Interactive test stopped'); }, false);
}
$pdo->exec('CREATE DATABASE `' . $database . '`');
try {
    Db::execute('CREATE TABLE eb_tenant (id INT UNSIGNED PRIMARY KEY, name VARCHAR(100), code VARCHAR(64), status INT)');
    Db::execute(file_get_contents(dirname(__DIR__) . '/upgrade/tenant_credentials.sql'));
    Db::name('tenant')->insertAll([
        ['id' => 1, 'name' => 'A', 'code' => 'a', 'status' => 1],
        ['id' => 2, 'name' => 'B', 'code' => 'b', 'status' => 1],
    ]);
    Db::execute('CREATE TABLE eb_tenant_test_item (id INT PRIMARY KEY, tenant_id INT, name VARCHAR(20))');
    Db::name('tenant_test_item')->insertAll([['id' => 1, 'tenant_id' => 1, 'name' => 'A'], ['id' => 2, 'tenant_id' => 2, 'name' => 'B']]);
    $service = new TenantCredentialServices();
    $super = ['level' => 0];
    $a = $service->generate($super, 1);
    $b = $service->generate($super, 2);
    $configPath = getenv('TENANT_TEST_ENTRY_CONFIG');
    $entries = ['store-a' => $a['client_id'], 'store-b' => $b['client_id'], 'broken' => 'invalid', 'missing' => str_repeat('0', 32)];
    file_put_contents($configPath, json_encode($entries));
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if (!$socket) throw new RuntimeException($error);
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $log = getenv('TENANT_TEST_CACHE') . '/http.log';
    $server = proc_open([PHP_BINARY, '-S', $address, __DIR__ . '/tenant_http_router.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes);
    if (!is_resource($server)) throw new RuntimeException('HTTP server failed to start');
    fclose($pipes[0]);
    $ready = false;
    for ($attempt = 0; $attempt < 100; $attempt++) {
        if (!proc_get_status($server)['running']) throw new RuntimeException('HTTP server exited');
        $connection = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
        if ($connection) { fclose($connection); $ready = true; break; }
        usleep(20000);
    }
    check($ready, 'isolated HTTP server ready');
    $base = 'http://' . $address . '/api/';
    if (getenv('TENANT_TEST_INTERACTIVE') === '1') {
        echo "Isolated API: " . $base . "\nPOST tenant/bootstrap: {\"entry\":\"store-a\"} or {\"entry\":\"store-b\"}\n";
        echo "GET __test/items with X-Tenant-Token reads that tenant's fixture. No production data or login.\nPress Enter to run reset/revocation checks and shut down.\n";
        while (true) {
            $read = [STDIN];
            $write = $except = [];
            $inputReady = @stream_select($read, $write, $except, 0, 200000);
            pcntl_signal_dispatch();
            if ($inputReady === false) throw new RuntimeException('Interactive input interrupted');
            if ($inputReady > 0) { fgets(STDIN); break; }
        }
    }
    [$tokenA, $headers, $httpStatus] = httpCall($base, 'tenant/bootstrap', ['entry' => 'store-a']);
    check($httpStatus === 200 && $tokenA['status'] === 200 && $tokenA['data']['tenant']['id'] === 1, 'HTTP anonymous cold bootstrap binds A');
    check((bool)preg_match('/^Cache-Control:\s*no-store\s*$/mi', $headers) && (bool)preg_match('#^Access-Control-Allow-Origin:\s*https://public-client.example\s*$#mi', $headers), 'HTTP bootstrap is no-store and CORS readable');
    check(array_keys($tokenA['data']) === ['tenant', 'tenant_token', 'expires_in'] && $tokenA['data']['expires_in'] === 3600, 'HTTP public response contains only tenant, token and TTL');
    [$tokenB] = httpCall($base, 'tenant/bootstrap', ['entry' => 'store-b']);
    check($tokenB['data']['tenant']['id'] === 2, 'HTTP anonymous cold bootstrap binds B');
    foreach ([$tokenA, $tokenB] as $result) {
        $id = $result['data']['tenant']['id'];
        [$items] = httpCall($base, '__test/items?tenant_id=' . (3 - $id), null, ['X-Tenant-Token: ' . $result['data']['tenant_token']]);
        check($items['data']['tenant_id'] === $id && count($items['data']['items']) === 1 && $items['data']['items'][0]['tenant_id'] === $id, 'HTTP ORM isolation for tenant ' . $id);
    }
    [$user] = httpCall($base, '__test/user', null, ['X-Tenant-Token: ' . $tokenA['data']['tenant_token']]);
    check($user['status'] === 401 && !isset($user['data']['code']), 'HTTP tenant token alone cannot authenticate user; user 401 is distinct');
    Db::execute('CREATE TABLE eb_user (uid INT PRIMARY KEY, tenant_id INT, is_del INT, status INT, last_time INT)');
    Db::name('user')->insert(['uid' => 11, 'tenant_id' => 1, 'is_del' => 0, 'status' => 1, 'last_time' => 0]);
    $app->config->set(['default' => 'file', 'stores' => ['file' => [
        'type' => 'File', 'path' => getenv('TENANT_TEST_CACHE') . '/',
    ]]], 'cache');
    testRequest();
    $jwt = new \crmeb\utils\JwtAuth();
    $api = $jwt->createToken(11, 'api', ['tenant_id' => 1])['token'];
    $admin = $jwt->createToken(11, 'admin', ['tenant_id' => 1])['token'];
    [$login] = httpCall($base, '__test/user', null, ['X-Tenant-Token: ' . $tokenA['data']['tenant_token'], 'Authorization: Bearer ' . $api]);
    check($login['status'] === 200 && $login['data']['uid'] === 11, 'HTTP real api JWT authenticates user A');
    [$collision] = httpCall($base, '__test/user', null, ['X-Tenant-Token: ' . $tokenA['data']['tenant_token'], 'Authorization: Bearer ' . $admin]);
    check($collision['status'] === 401 && !isset($collision['data']['code']), 'HTTP real admin JWT UID collision cannot authenticate user');
    [$mismatch] = httpCall($base, '__test/user', null, ['X-Tenant-Token: ' . $tokenB['data']['tenant_token'], 'Authorization: Bearer ' . $api]);
    check($mismatch['status'] === 403, 'HTTP user A JWT cannot enter B');
    foreach ([[], ['entry' => []], ['entry' => '../a'], ['entry' => 'store-a', 'tenant_id' => 2], ['client_id' => $a['client_id']]] as $input) {
        [$error] = httpCall($base, 'tenant/bootstrap', $input);
        check($error['status'] === 400 && $error['data']['code'] === 'tenant_bootstrap_invalid_request', 'HTTP rejects invalid or overriding bootstrap input');
    }
    [$unknown] = httpCall($base, 'tenant/bootstrap', ['entry' => 'unpublished'], ['Host: store-a.example', 'X-Forwarded-Host: store-b.example']);
    check($unknown['status'] === 403 && $unknown['data']['code'] === 'tenant_bootstrap_unavailable', 'HTTP forged Host cannot publish unknown entry');
    [$host] = httpCall($base, 'tenant/bootstrap?tenant_id=2&client_id=' . $b['client_id'], ['entry' => 'store-a'], ['Host: store-b.example', 'X-Forwarded-Host: store-b.example']);
    check($host['data']['tenant']['id'] === 1, 'HTTP Host and query cannot override configured A binding');
    foreach (['broken', 'missing'] as $entry) {
        [$error] = httpCall($base, 'tenant/bootstrap', ['entry' => $entry]);
        check($error['status'] === 503 && $error['data']['code'] === 'tenant_bootstrap_unavailable', 'HTTP invalid deployment mapping fails closed: ' . $entry);
    }
    [$invalid, $headers] = httpCall($base, '__test/items', null, ['X-Tenant-Token: invalid']);
    check($invalid['status'] === 401 && $invalid['data']['code'] === 'tenant_token_invalid' && (bool)preg_match('/^Cache-Control:\s*no-store\s*$/mi', $headers), 'HTTP tenant 401 is machine identifiable and not cached');
    [$staleBootstrap] = httpCall($base, 'tenant/bootstrap', ['entry' => 'store-a'], ['X-Tenant-Token: invalid']);
    check($staleBootstrap['status'] === 401, 'HTTP renewal must omit stale tenant header');
    $row = Db::name('tenant_credential')->where('tenant_id', 1)->find();
    $expired = $a['client_id'] . '.' . (time() - 1) . '.' . str_repeat('0', 32);
    [$expiry] = httpCall($base, '__test/items', null, ['X-Tenant-Token: ' . $expired . '.' . hash_hmac('sha256', $expired, $row['secret_hash'])]);
    check($expiry['status'] === 401 && $expiry['data']['code'] === 'tenant_token_invalid', 'HTTP expired signed token requests renewal');
    $service->generate($super, 1, true);
    [$revoked] = httpCall($base, '__test/items', null, ['X-Tenant-Token: ' . $tokenA['data']['tenant_token']]);
    check($revoked['status'] === 401 && $revoked['data']['code'] === 'tenant_token_invalid', 'HTTP reset revokes old A token');
    [$renewed] = httpCall($base, 'tenant/bootstrap', ['entry' => 'store-a']);
    check($renewed['status'] === 200 && $service->resolve($renewed['data']['tenant_token']) === 1, 'HTTP bootstrap after reset needs no secret/config update');
    check($service->resolve($tokenB['data']['tenant_token']) === 2, 'A reset does not revoke B token');
    Db::name('tenant')->where('id', 2)->update(['status' => 0]);
    [$disabled] = httpCall($base, 'tenant/bootstrap', ['entry' => 'store-b']);
    check($disabled['status'] === 503, 'HTTP disabled tenant cannot bootstrap');
    [$disabledToken] = httpCall($base, '__test/items', null, ['X-Tenant-Token: ' . $tokenB['data']['tenant_token']]);
    check($disabledToken['status'] === 401, 'HTTP disabled tenant token rejected');
    file_put_contents($configPath, json_encode([]));
    [$closed] = httpCall($base, 'tenant/bootstrap', ['entry' => 'store-a']);
    check($closed['status'] === 403, 'HTTP empty publication config fails closed');
    echo "All public bootstrap HTTP checks passed.\n";
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    $pdo->exec('DROP DATABASE `' . $database . '`');
}
