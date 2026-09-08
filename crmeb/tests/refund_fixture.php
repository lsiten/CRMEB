<?php

require dirname(__DIR__) . '/vendor/autoload.php';
require dirname(__DIR__) . '/vendor/topthink/framework/src/helper.php';

// Test bootstrap deliberately does not load .env or deployed application services.
function getLang($message, array $replace = []) { return $message; }
function sys_config($name, $default = '') { return $default; }

function refundApp(string $directory): think\App
{
    $app = new think\App();
    $app->setRuntimePath($directory . '/runtime/');
    think\Container::setInstance($app);
    $app->instance('json', new crmeb\utils\Json());
    $app->instance('request', new app\Request());
    $connection = is_file($directory . '/mysql.json') ? json_decode(file_get_contents($directory . '/mysql.json'), true) : [
        'type' => 'sqlite', 'database' => $directory . '/fixture.sqlite',
        'prefix' => '', 'fields_strict' => true, 'trigger_sql' => false,
    ];
    $app->config->set(['default' => 'test', 'connections' => ['test' => $connection]], 'database');
    $app->config->set(['default' => 'file', 'stores' => ['file' => [
        'type' => 'File', 'path' => $directory . '/cache/',
    ]]], 'cache');
    $app->env->set(['app' => ['app_key' => 'refund-isolated-test-key']]);
    (new think\service\ModelService($app))->boot();
    return $app;
}

function seedRefunds(think\App $app): array
{
    $db = $app->db;
    $db->execute('CREATE TABLE user (uid INTEGER PRIMARY KEY, tenant_id INTEGER, nickname TEXT, avatar TEXT, is_del INTEGER DEFAULT 0, status INTEGER DEFAULT 1, last_time INTEGER)');
    $db->execute('CREATE TABLE store_order (id INTEGER PRIMARY KEY, tenant_id INTEGER, uid INTEGER, pay_uid INTEGER, order_id TEXT, pay_time INTEGER DEFAULT 0, seckill_id INTEGER DEFAULT 0, bargain_id INTEGER DEFAULT 0, combination_id INTEGER DEFAULT 0, pay_type TEXT, real_name TEXT, user_phone TEXT, user_address TEXT)');
    $db->execute('CREATE TABLE store_order_refund (id INTEGER PRIMARY KEY, tenant_id INTEGER, uid INTEGER, store_order_id INTEGER, order_id TEXT, cart_info TEXT, refund_img TEXT, refund_type INTEGER DEFAULT 1, refund_num INTEGER DEFAULT 1, refund_price TEXT, refunded_price TEXT, refund_explain TEXT, add_time INTEGER DEFAULT 0, is_cancel INTEGER DEFAULT 0, is_del INTEGER DEFAULT 0)');
    $db->execute('CREATE TABLE express (id INTEGER PRIMARY KEY, tenant_id INTEGER, name TEXT, code TEXT, partner_id TEXT, partner_key TEXT, net TEXT, account TEXT, `key` TEXT, net_name TEXT, is_show INTEGER, sort INTEGER)');
    foreach ([[7, 1], [8, 1], [9, 2]] as [$uid, $tenant]) {
        $db->table('user')->insert(['uid' => $uid, 'tenant_id' => $tenant, 'nickname' => 'fixture-' . $uid, 'avatar' => '']);
    }
    foreach ([[1, 7, 1], [2, 8, 1], [3, 9, 2], [4, 7, 2]] as [$id, $uid, $tenant]) {
        $db->table('store_order')->insert(['id' => $id, 'tenant_id' => $tenant, 'uid' => $uid, 'pay_uid' => $uid,
            'order_id' => 'order-' . $id, 'pay_type' => 'yue', 'real_name' => 'fixture', 'user_phone' => '00000000000', 'user_address' => 'synthetic address']);
    }
    $cart = json_encode([['truePrice' => '10.00', 'cart_num' => 2, 'vip_truePrice' => '0.00', 'postage_price' => '0.00', 'price_type' => 'normal']]);
    foreach ([[1, 7, 1, 1], [2, 8, 1, 2], [3, 9, 2, 3], [4, 7, 2, 4],
        [5, 7, 1, 2], [6, 7, 1, 4], [7, 7, 1, 999]] as [$id, $uid, $tenant, $order]) {
        $db->table('store_order_refund')->insert(['id' => $id, 'tenant_id' => $tenant, 'uid' => $uid,
            'store_order_id' => $order, 'order_id' => 'refund' . $id, 'cart_info' => $cart,
            'refund_img' => '[]', 'refund_price' => '20.00', 'refunded_price' => '12.50', 'refund_explain' => 'fixture']);
    }
    $tokens = [];
    foreach (['a' => [7, 1], 'b' => [8, 1], 'c' => [9, 2]] as $key => [$uid, $tenant]) {
        $tokens[$key] = $app->make(crmeb\utils\JwtAuth::class)->createToken($uid, 'api', ['tenant_id' => $tenant])['token'];
    }
    return $tokens;
}

function refundCheck(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function removeRefundFixture(string $directory): void
{
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $file) {
        $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
    }
    rmdir($directory);
}
