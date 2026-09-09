<?php
$scratch = getenv('TENANT_HEADER_SCRATCH') ?: '';
$database = getenv('TENANT_HEADER_DATABASE') ?: '';
if (!preg_match('/^lsit30_test_[a-f0-9]+$/D', $database) || !is_dir($scratch . '/app')) exit(2);
require $scratch . '/app/vendor/autoload.php';
$app = new think\App($scratch . '/app/');
$app->initialize();
if (config('database.connections.mysql.database') !== $database
    || (int)config('database.connections.mysql.hostport') === 3306) exit(2);
use think\facade\Db;
use crmeb\services\TenantContext;
use app\services\other\CacheServices;
$cache = $app->make(CacheServices::class);
$fixture = json_decode(file_get_contents($scratch . '/fixture.json'), true);
$failures = 0;
function verifyKf(bool $ok, string $label): void {
    global $failures;
    echo ($ok ? 'PASS ' : 'FAIL ') . $label . PHP_EOL;
    if (!$ok) ++$failures;
}
function requestKf(int $id): array {
    global $fixture;
    $ch = curl_init('http://127.0.0.1:' . getenv('TENANT_HEADER_HTTP_PORT') . '/kefuapi/tourist/adv');
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['appid: ' . $fixture[$id]['client_id'], 'screct_id: ' . $fixture[$id]['app_secret']],
        CURLOPT_HEADER => true]);
    $raw = curl_exec($ch);
    $size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return ['headers' => substr($raw, 0, $size), 'body' => json_decode(substr($raw, $size), true)];
}
set_exception_handler(function (Throwable $e) { fwrite(STDERR, $e->getMessage() . PHP_EOL); exit(1); });
if (($argv[1] ?? '') === '--writer') {
    TenantContext::set((int)$argv[2]);
    for ($i = 0; $i < 10; ++$i) $cache->setDbCache('kf_adv', 'tenant-' . $argv[2]);
    exit;
}
foreach ([[1, 2], [2, 1]] as $order) {
    foreach ($order as $id) { TenantContext::set($id); $cache->delectDbCache('kf_adv'); }
    foreach (array_merge($order, $order) as $index => $id) {
        $response = requestKf($id);
        echo 'HTTP ' . implode('->', $order) . ' ' . ($index < 2 ? 'cold' : 'warm') . ' tenant ' . $id
            . ' ' . json_encode($response['body'], JSON_UNESCAPED_UNICODE) . PHP_EOL;
        echo 'Cache-Control: ' . (preg_match('/^Cache-Control:\s*(.+)$/mi', $response['headers'], $match) ? trim($match[1]) : '(absent)') . PHP_EOL;
        verifyKf(($response['body']['status'] ?? 0) === 200, 'HTTP advert tenant ' . $id);
    }
    echo 'ROWS ' . json_encode(Db::name('cache')->whereIn('key', ['kf_adv', 'tenant:1:kf_adv', 'tenant:2:kf_adv'])
        ->field('key,tenant_id,result')->order('key')->select()->toArray(), JSON_UNESCAPED_UNICODE) . PHP_EOL;
}
if ($failures) exit(1);
foreach (['kf_adv', 'open_adv'] as $key) {
    foreach ([1, 2] as $owner) {
        $other = 3 - $owner;
        foreach ([1, 2] as $id) { TenantContext::set($id); $cache->delectDbCache($key); }
        Db::name('cache')->insert(['key' => $key, 'tenant_id' => $owner,
            'result' => json_encode('legacy-' . $owner), 'expire_time' => 0, 'add_time' => time()]);
        TenantContext::set($other);
        verifyKf(!$cache->checkDbCache($key), "$key legacy hidden from $other");
        $cache->setDbCache($key, 'tenant-' . $other);
        verifyKf(Db::name('cache')->where('key', $key)->value('tenant_id') == $owner, "$key preserves other legacy");
        TenantContext::set($owner);
        verifyKf($cache->getDbCache($key, '') === 'legacy-' . $owner, "$key owned legacy read");
        verifyKf($cache->checkDbCache($key, 'legacy-' . $owner), "$key legacy exists");
        $cache->setDbCache($key, 'tenant-' . $owner);
        verifyKf(Db::name('cache')->where('key', $key)->count() === 0, "$key write retires legacy");
        verifyKf($cache->getDbCache($key, '') === 'tenant-' . $owner, "$key updated read");
        TenantContext::set($other);
        verifyKf($cache->getDbCache($key, '') === 'tenant-' . $other, "$key update preserves other");
        TenantContext::set($owner);
        Db::name('cache')->insert(['key' => $key, 'tenant_id' => $owner,
            'result' => json_encode('stale'), 'expire_time' => 0, 'add_time' => time()]);
        $cache->delectDbCache($key);
        verifyKf(!$cache->checkDbCache($key), "$key delete both keys without resurrection");
        verifyKf($cache->getDbCache($key, function () { return 'refreshed'; }) === 'refreshed', "$key refresh after delete");
        $cache->setDbCache($key, 'expired', -1);
        verifyKf(!$cache->checkDbCache($key), "$key expired cache absent");
        verifyKf($cache->getDbCache($key, function () { return 'fresh'; }) === 'fresh', "$key refresh after expiry");
        TenantContext::set($other);
        verifyKf($cache->getDbCache($key, '') === 'tenant-' . $other, "$key delete/expiry preserves other");
    }
}
$children = [];
foreach ([1, 2, 1, 2] as $id) {
    $process = proc_open([PHP_BINARY, __FILE__, '--writer', (string)$id],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    fclose($pipes[0]);
    $children[] = [$process, $pipes];
}
foreach ($children as [$process, $pipes]) {
    $output = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    verifyKf(proc_close($process) === 0, 'concurrent writer ' . trim($output));
}
foreach ([2, 1, 2, 1] as $id) {
    TenantContext::set($id);
    $response = requestKf($id);
    verifyKf(($response['body']['data']['content'] ?? null) === 'tenant-' . $id, 'HTTP warm edited tenant ' . $id);
    verifyKf(Db::name('cache')->where('key', TenantContext::key('kf_adv'))->count() === 1, 'single physical row ' . $id);
}
TenantContext::set(2);
$cache->delectDbCache('kf_adv');
verifyKf(requestKf(2)['body']['data']['content'] === '', 'HTTP deleted tenant 2 default');
verifyKf(requestKf(1)['body']['data']['content'] === 'tenant-1', 'HTTP delete preserves tenant 1');
TenantContext::set(2);
Db::name('cache')->where('key', TenantContext::key('kf_adv'))->update(['tenant_id' => 1]);
try {
    $cache->setDbCache('kf_adv', 'invalid-overwrite');
    verifyKf(false, 'wrong owner rejected');
} catch (RuntimeException $e) {
    verifyKf(Db::name('cache')->where('key', TenantContext::key('kf_adv'))->value('result') === json_encode(''), 'wrong owner rollback');
}
echo 'RESULT failures=' . $failures . PHP_EOL;
exit($failures ? 1 : 0);
