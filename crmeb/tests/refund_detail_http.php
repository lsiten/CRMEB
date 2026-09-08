<?php

require __DIR__ . '/refund_fixture.php';
require __DIR__ . '/refund_mysql_fixture.php';

$directory = sys_get_temp_dir() . '/crmeb-refund-http-' . bin2hex(random_bytes(8));
mkdir($directory, 0700);
$server = null;
$mysql = null;
try {
    if (getenv('REFUND_MYSQLD')) {
        [$mysql, $connection] = startRefundMysql($directory, getenv('REFUND_MYSQLD'));
        file_put_contents($directory . '/mysql.json', json_encode($connection));
    }
    $app = refundApp($directory);
    $tokens = seedRefunds($app);
    $before = [$app->db->table('store_order')->order('id')->select()->toArray(),
        $app->db->table('store_order_refund')->order('id')->select()->toArray()];
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    refundCheck($socket !== false, 'Cannot allocate loopback port');
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $environment = getenv();
    $environment['CRMEB_REFUND_FIXTURE'] = $directory;
    $server = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-S', $address, __DIR__ . '/refund_http_router.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $directory . '/server.log', 'a'], 2 => ['file', $directory . '/server.log', 'a']], $pipes, __DIR__, $environment);
    refundCheck(is_resource($server), 'Cannot start isolated HTTP server');
    fclose($pipes[0]);
    for ($attempt = 0; $attempt < 50; $attempt++) {
        $ready = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
        if ($ready) { fclose($ready); break; }
        usleep(100000);
    }
    refundCheck((bool)$ready, 'HTTP server did not start');
    $failures = 0;
    $cases = [
        'owner' => ['refund1', 'a', 200],
        'cross-account' => ['refund1', 'b', 400],
        'cross-tenant' => ['refund1', 'c', 400],
        'same-uid-other-tenant' => ['refund4', 'a', 400],
        'wrong-linked-owner' => ['refund5', 'a', 400],
        'wrong-linked-tenant' => ['refund6', 'a', 400],
        'missing-linked-order' => ['refund7', 'a', 400],
        'nonexistent' => ['refund999', 'a', 400],
        'anonymous' => ['refund1', '', 401],
        'invalid-token' => ['refund1', 'invalid', 401],
        'tenant-two-owner' => ['refund3', 'c', 200],
        'owner-after-denials' => ['refund1', 'a', 200],
    ];
    foreach (['Authori-zation', 'Authorization'] as $header) {
        foreach ($cases as $name => [$uni, $actor, $status]) {
            $curl = curl_init('http://' . $address . '/api/order/refund/detail/' . $uni . '?uid=7&tenant_id=1');
            curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => $actor === '' ? [] : [$header . ': Bearer ' . ($tokens[$actor] ?? 'invalid')]]);
            $body = curl_exec($curl);
            $http = curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);
            $data = json_decode((string)$body, true);
            $ok = $http === 200 && ($data['status'] ?? null) === $status;
            if ($status === 400) $ok = $ok && $data === ['status' => 400, 'msg' => '订单不存在', 'data' => []];
            if ($status === 200) $ok = $ok && $data['data']['pay_price'] === '20.00' && $data['data']['refunded_price'] === '12.50' && $data['data']['cartInfo'][0]['cart_num'] === 2;
            echo ($ok ? 'PASS ' : 'FAIL ') . "$header $name HTTP=$http body=" . ($status === 200 && $ok ? '{status:200,pay_price:20.00,cart_num:2}' : (string)$body) . PHP_EOL;
            if (!$ok) $failures++;
        }
    }
    foreach (['cross-account' => ['refund1', 'b'], 'cross-tenant' => ['refund1', 'c'],
        'wrong-linked-owner' => ['refund5', 'a'], 'wrong-linked-tenant' => ['refund6', 'a'],
        'nonexistent' => ['refund999', 'a']] as $name => [$uni, $actor]) {
        $curl = curl_init('http://' . $address . '/api/order/express/' . $uni . '/refund');
        curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => ['Authori-zation: Bearer ' . $tokens[$actor]]]);
        $body = curl_exec($curl);
        $http = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);
        $ok = $http === 200 && json_decode((string)$body, true) === ['status' => 400, 'msg' => '订单不存在', 'data' => []];
        echo ($ok ? 'PASS ' : 'FAIL ') . "refund-express $name HTTP=$http body=$body\n";
        if (!$ok) $failures++;
    }
    if ($failures) echo file_get_contents($directory . '/server.log');
    refundCheck($failures === 0, "$failures HTTP authorization checks failed");
    refundCheck($before === [$app->db->table('store_order')->order('id')->select()->toArray(),
        $app->db->table('store_order_refund')->order('id')->select()->toArray()], 'Read endpoints changed orders/refunds');
    echo "PASS order/refund rows unchanged (authentication may update user.last_time)\n";
    echo "PASS 29 real HTTP checks; production routes/auth/JWT/DAO/model scopes; isolated database/cache\n";
} finally {
    if (is_resource($server)) {
        $pid = proc_get_status($server)['pid'];
        refundCheck($pid !== (int)getenv('REFUND_PROTECTED_PID'), 'Refusing to terminate protected daemon');
        proc_terminate($server);
        proc_close($server);
    }
    if ($mysql !== null) stopRefundMysql($mysql);
    removeRefundFixture($directory);
}
