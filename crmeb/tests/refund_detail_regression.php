<?php

require __DIR__ . '/refund_fixture.php';

$directory = sys_get_temp_dir() . '/crmeb-refund-' . bin2hex(random_bytes(8));
mkdir($directory, 0700);
try {
    $app = refundApp($directory);
    seedRefunds($app);
    $controller = $app->make(app\api\controller\v1\order\StoreOrderRefundController::class);
    $service = $app->make(app\services\order\StoreOrderRefundServices::class);
    $invoke = function (string $uni, int $uid, int $tenant) use ($controller) {
        crmeb\services\TenantContext::set($tenant);
        $request = new app\Request();
        $request->macro('uid', function () use ($uid) { return $uid; });
        try {
            return $controller->refundDetail($request, $uni)->getData();
        } catch (crmeb\exceptions\ApiException $e) {
            return app('json')->fail($e->getMessage())->getData();
        }
    };
    $failures = 0;
    foreach (['same-account' => ['refund1', 7, 1, 200],
        'cross-account' => ['refund1', 8, 1, 400],
        'cross-tenant' => ['refund1', 9, 2, 400],
        'same-uid-other-tenant' => ['refund4', 7, 1, 400],
        'wrong-linked-owner' => ['refund5', 7, 1, 400],
        'wrong-linked-tenant' => ['refund6', 7, 1, 400],
        'missing-linked-order' => ['refund7', 7, 1, 400],
        'nonexistent' => ['refund999', 7, 1, 400],
        'zero-uid' => ['refund1', 0, 1, 400],
        'negative-uid' => ['refund1', -7, 1, 400],
        'tenant-two-owner' => ['refund3', 9, 2, 200]] as $name => [$uni, $uid, $tenant, $status]) {
        $result = $invoke($uni, $uid, $tenant);
        $ok = $result['status'] === $status && ($status === 200 || $result === ['status' => 400, 'msg' => '订单不存在']);
        echo ($ok ? 'PASS ' : 'FAIL ') . $name . ' status=' . $result['status'] . PHP_EOL;
        if (!$ok) $failures++;
    }
    crmeb\services\TenantContext::set(1);
    $legacy = $service->refundDetail('refund1');
    refundCheck($invoke('refund1', 7, 1)['data'] === $legacy, 'Successful response differs from existing formatter');
    echo "PASS successful response matches existing admin formatter\n";
    foreach ([1, 2, 3, 4, 5, 6] as $type) {
        $app->db->table('store_order_refund')->where('id', 1)->update(['refund_type' => $type]);
        $expected = $service->refundDetail('refund1');
        refundCheck($invoke('refund1', 7, 1)['data'] === $expected, "Refund stage $type changed");
        echo "PASS stage $type compatibility\n";
    }
    $app->db->table('store_order_refund')->where('id', 1)->update(['is_cancel' => 1]);
    refundCheck($invoke('refund1', 7, 1)['data']['is_cancel'] === 1, 'Cancelled detail no longer readable');
    echo "PASS cancelled detail remains readable\n";
    refundCheck($invoke(' ', 7, 1) === ['status' => 400, 'msg' => '参数错误'], 'Empty order error changed');
    echo "PASS empty order parameter compatibility\n";
    refundCheck($failures === 0, "$failures authorization regressions failed");
} finally {
    removeRefundFixture($directory);
}
