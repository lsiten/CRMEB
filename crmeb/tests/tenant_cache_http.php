<?php
$database = getenv('TENANT_CONFIG_TEST_DATABASE');
if (!$database || strpos($database, 'lsit21_config_test_') !== 0
    || !preg_match('~^http://127\.0\.0\.1:[1-9][0-9]{3,4}$~D', getenv('TENANT_CACHE_HTTP_URL') ?: '')) exit(2);
require dirname(__DIR__) . '/vendor/autoload.php';
$app = new think\App(dirname(__DIR__) . '/');
$app->initialize();
if (config('database.connections.mysql.database') !== $database) exit(2);
set_exception_handler(function (Throwable $error) { fwrite(STDERR, $error->getMessage() . PHP_EOL); exit(1); });
use crmeb\services\TenantContext;
use crmeb\services\SystemConfigService;
use app\services\other\CacheServices;
use app\services\system\config\SystemConfigServices;
function api(string $path, string $token = '', ?array $body = null) {
    $curl = curl_init(getenv('TENANT_CACHE_HTTP_URL') . '/api/' . $path);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Tenant-Token: ' . $token]]);
    if ($body !== null) curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body)]);
    $raw = curl_exec($curl);
    $http = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    $data = json_decode($raw, true);
    if ($http !== 200 || ($data['status'] ?? 0) !== 200) throw new RuntimeException($path . ': ' . ($data['msg'] ?? 'invalid response'));
    return $data['data'] ?? null;
}
function assertHttp(bool $condition, string $label): void {
    if (!$condition) throw new RuntimeException('FAIL ' . $label);
    echo 'PASS ' . $label . PHP_EOL;
}
$names = [1 => 'HTTP甲店', 2 => 'HTTP乙店'];
$ads = [];
$tokens = [];
foreach ([1 => 'store-a', 2 => 'store-b'] as $id => $entry) {
    TenantContext::set($id);
    $app->make(SystemConfigServices::class)->update(['menu_name' => 'site_name'], ['value' => json_encode($names[$id])]);
    $ads[$id] = ['status' => 1, 'time' => 5, 'type' => 'pic', 'value' => [['pic' => 'https://example.test/advert-' . $id . '.png']], 'video_link' => ''];
    $app->make(CacheServices::class)->setDbCache('open_adv', $ads[$id]);
    $bootstrap = api('tenant/bootstrap', '', ['entry' => $entry]);
    assertHttp($bootstrap['tenant']['id'] === $id, 'bootstrap tenant ' . $id);
    $tokens[$id] = $bootstrap['tenant_token'];
}
foreach ([[1,2,1], [2,1,2]] as $order) {
    foreach ([1,2] as $id) { TenantContext::set($id); SystemConfigService::clear(); }
    foreach (['cold', 'hot'] as $temperature) {
        foreach ($order as $id) {
            foreach (['basic_config', 'index'] as $path) {
                $data = api($path, $tokens[$id]);
                assertHttp(($data['site_name'] ?? '') === $names[$id], $temperature . ' ' . implode('-', $order) . ' ' . $path . ' = ' . $names[$id]);
            }
            assertHttp(api('get_open_adv', $tokens[$id]) === $ads[$id], $temperature . ' advert belongs to tenant ' . $id);
        }
    }
}
TenantContext::set(2);
$names[2] = 'HTTP乙店更新';
$app->make(SystemConfigServices::class)->update(['menu_name' => 'site_name'], ['value' => json_encode($names[2])]);
$ads[2]['value'][0]['pic'] = 'https://example.test/advert-2-updated.png';
$app->make(CacheServices::class)->setDbCache('open_adv', $ads[2]);
foreach ([2,1,2] as $id) {
    foreach (['basic_config', 'index'] as $path) assertHttp(api($path, $tokens[$id])['site_name'] === $names[$id], 'after tenant 2 update: ' . $path . ' ' . $names[$id]);
    assertHttp(api('get_open_adv', $tokens[$id]) === $ads[$id], 'after update advert belongs to ' . $id);
    foreach (['site_config', 'theme_info/home', 'products'] as $path) {
        $data = api($path, $tokens[$id]);
        if ($path === 'theme_info/home') assertHttp(!empty($data['value']), 'home theme tenant ' . $id);
        if ($path === 'products') {
            $ids = array_map('intval', array_column($data, 'id'));
            assertHttp($id === 2 ? $ids === [2] : !in_array(2, $ids, true), 'products tenant ' . $id . ' ' . json_encode($ids));
        }
    }
}
foreach ([2, 1] as $legacyOwner) {
    foreach ([1,2] as $id) {
        TenantContext::set($id);
        $app->make(CacheServices::class)->delectDbCache('open_adv');
    }
    think\facade\Db::name('cache')->insert(['key' => 'open_adv', 'tenant_id' => $legacyOwner,
        'result' => json_encode($ads[$legacyOwner]), 'expire_time' => 0, 'add_time' => time()]);
    $other = 3 - $legacyOwner;
    assertHttp(api('get_open_adv', $tokens[$other]) === null, 'cold missing advert uses default tenant ' . $other);
    assertHttp(api('get_open_adv', $tokens[$legacyOwner]) === $ads[$legacyOwner], 'HTTP legacy advert owner ' . $legacyOwner);
    TenantContext::set($legacyOwner);
    $app->make(CacheServices::class)->setDbCache('open_adv', $ads[$legacyOwner]);
    assertHttp(api('get_open_adv', $tokens[$legacyOwner]) === $ads[$legacyOwner], 'HTTP legacy migration owner ' . $legacyOwner);
    TenantContext::set($other);
    $app->make(CacheServices::class)->setDbCache('open_adv', $ads[$other]);
    foreach ([$other, $legacyOwner, $other] as $id) {
        assertHttp(api('get_open_adv', $tokens[$id]) === $ads[$id], 'HTTP warm legacy sequence owner ' . $id);
    }
}
