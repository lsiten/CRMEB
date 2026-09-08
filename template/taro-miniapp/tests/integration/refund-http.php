<?php

$root = dirname(__DIR__, 4);
require $root . '/crmeb/tests/refund_fixture.php';

$directory = sys_get_temp_dir() . '/taro-refund-http-' . bin2hex(random_bytes(8));
mkdir($directory, 0700);
$server = null;
try {
    $app = refundApp($directory);
    $tokens = seedRefunds($app);
    $cart = json_encode([[
        'id' => 'cart81', 'cart_num' => 2, 'truePrice' => '50.00',
        'vip_truePrice' => '0.00', 'postage_price' => '0.00', 'price_type' => 'normal',
        'productInfo' => ['id' => 81, 'store_name' => '售后联调咖啡',
            'image' => 'https://example.invalid/coffee.png', 'attrInfo' => ['suk' => '250g']],
    ]], JSON_UNESCAPED_UNICODE);
    $app->db->table('store_order_refund')->where('id', '>', 0)->update([
        'cart_info' => $cart, 'refund_type' => 6, 'refund_price' => '100.00', 'refunded_price' => '60.00',
    ]);
    $before = [$app->db->table('store_order')->order('id')->select()->toArray(),
        $app->db->table('store_order_refund')->order('id')->select()->toArray()];
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    refundCheck($socket !== false, 'Cannot allocate loopback port');
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $environment = getenv();
    $environment['CRMEB_REFUND_FIXTURE'] = $directory;
    $server = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-S', $address,
        $root . '/crmeb/tests/refund_http_router.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $directory . '/server.log', 'a'],
            2 => ['file', $directory . '/server.log', 'a']], $pipes, $root, $environment);
    refundCheck(is_resource($server), 'Cannot start isolated HTTP server');
    fclose($pipes[0]);
    $ready = false;
    for ($attempt = 0; $attempt < 50; $attempt++) {
        $ready = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
        if ($ready) { fclose($ready); break; }
        usleep(100000);
    }
    refundCheck((bool)$ready, 'HTTP server did not start');
    $environment['TARO_API_BASE_URL'] = 'http://' . $address . '/api';
    $environment['TARO_TELEMETRY_URL'] = '';
    foreach ($tokens as $actor => $token) $environment['REFUND_TOKEN_' . strtoupper($actor)] = $token;
    foreach (['h5', 'weapp'] as $platform) {
        $environment['TARO_ENV'] = $platform;
        echo "Taro request contract platform=$platform\n";
        $test = proc_open(['pnpm', 'exec', 'vitest', 'run', '--config', 'tests/integration/vitest.config.mjs'],
            [0 => ['pipe', 'r'], 1 => STDOUT, 2 => STDERR], $testPipes, dirname(__DIR__, 2), $environment);
        refundCheck(is_resource($test), 'Cannot start client integration tests');
        fclose($testPipes[0]);
        $exit = proc_close($test);
        refundCheck($exit === 0, 'Client integration tests failed');
    }
    refundCheck($before === [$app->db->table('store_order')->order('id')->select()->toArray(),
        $app->db->table('store_order_refund')->order('id')->select()->toArray()], 'Read endpoints changed orders/refunds');
    echo "PASS order/refund rows unchanged; isolated SQLite fixture\n";
} finally {
    if (is_resource($server)) {
        $pid = proc_get_status($server)['pid'];
        refundCheck($pid !== (int)getenv('REFUND_PROTECTED_PID'), 'Refusing to terminate protected daemon');
        proc_terminate($server);
        proc_close($server);
    }
    removeRefundFixture($directory);
}
