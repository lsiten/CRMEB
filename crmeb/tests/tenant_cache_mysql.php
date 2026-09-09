<?php
$database = getenv('TENANT_CONFIG_TEST_DATABASE');
if (!$database || strpos($database, 'lsit21_config_test_') !== 0) exit(2);
require dirname(__DIR__) . '/vendor/autoload.php';
$app = new think\App(dirname(__DIR__) . '/');
$app->initialize();
set_exception_handler(function (Throwable $error) { fwrite(STDERR, $error->getMessage() . PHP_EOL); exit(1); });
use crmeb\services\TenantContext;
use crmeb\services\SystemConfigService;
use app\services\other\CacheServices;
use think\facade\Db;

if (config('database.connections.mysql.database') !== $database
    || (int)config('database.connections.mysql.hostport') === 3306) exit(2);
$cache = $app->make(CacheServices::class);
if (($argv[1] ?? '') === '--writer') {
    TenantContext::set((int)$argv[2]);
    usleep(200000);
    for ($i = 0; $i < 10; $i++) $cache->setDbCache('open_adv', ['owner' => (int)$argv[2]]);
    exit(0);
}
$failures = 0;
function checkCache($condition, string $label): void {
    global $failures;
    echo ($condition ? 'PASS ' : 'FAIL ') . $label . PHP_EOL;
    if (!$condition) $failures++;
}
foreach ([1, 2] as $id) {
    Db::name('system_config')->where('tenant_id', $id)->where('menu_name', 'site_name')
        ->update(['value' => json_encode('cache-store-' . $id)]);
    TenantContext::set($id);
    if (method_exists(SystemConfigService::class, 'clear')) SystemConfigService::clear();
}
foreach ([1, 2, 1, 2, 1, 2] as $id) {
    TenantContext::set($id);
    checkCache(SystemConfigService::get('site_name') === 'cache-store-' . $id, 'single tenant ' . $id);
    checkCache((SystemConfigService::more(['site_name'])['site_name'] ?? '') === 'cache-store-' . $id, 'aggregate tenant ' . $id);
    try {
        $cache->setDbCache('open_adv', ['owner' => $id]);
        checkCache($cache->getDbCache('open_adv', '') === ['owner' => $id], 'advert tenant ' . $id);
    } catch (Throwable $error) {
        checkCache(false, 'advert tenant ' . $id . ': ' . $error->getMessage());
    }
}

$dao = $app->make(app\dao\system\config\SystemConfigDao::class);
TenantContext::set(1);
$tenantOneKey = SystemConfigService::cacheTag() . ':one:site_name';
checkCache(think\facade\Cache::has($tenantOneKey), 'tenant 1 warm cache exists');
TenantContext::set(2);
$dao->update(['menu_name' => 'site_name'], ['value' => json_encode('cache-store-2-updated')]);
checkCache(think\facade\Cache::has($tenantOneKey), 'tenant 2 update does not evict tenant 1');
checkCache(SystemConfigService::get('site_name') === 'cache-store-2-updated', 'update invalidates single');
checkCache(SystemConfigService::more(['site_name'])['site_name'] === 'cache-store-2-updated', 'update invalidates aggregate');
TenantContext::set(1);
checkCache(SystemConfigService::get('site_name') === 'cache-store-1', 'update leaves tenant 1');
checkCache(SystemConfigService::more(['site_name'])['site_name'] === 'cache-store-1', 'update leaves tenant 1 aggregate');
TenantContext::clear();
checkCache(SystemConfigService::get('site_name') === 'cache-store-1', 'default tenant config');
TenantContext::set(2);
$key = 'cache_regression_setting';
$dao->delete(['menu_name' => $key]);
SystemConfigService::get($key);
SystemConfigService::more([$key]);
$sample = Db::name('system_config')->where('tenant_id', 2)->where('menu_name', 'site_name')->find();
unset($sample['id']);
$sample['menu_name'] = $key;
$sample['value'] = json_encode('created');
$dao->save($sample);
checkCache(SystemConfigService::get($key) === 'created', 'create invalidates missing single');
checkCache(SystemConfigService::more([$key])[$key] === 'created', 'create invalidates missing aggregate');
$dao->batchUpdate([$key], ['value' => json_encode('batch')], 'menu_name');
checkCache(SystemConfigService::get($key) === 'batch', 'batch update invalidates cache');
$dao->delete(['menu_name' => $key]);
checkCache(SystemConfigService::get($key) !== 'batch', 'delete invalidates single');
checkCache((SystemConfigService::more([$key])[$key] ?? '') !== 'created', 'delete invalidates aggregate');
think\facade\Cache::set('system_config_site_name', 'poisoned-global');
SystemConfigService::clear();
checkCache(SystemConfigService::get('site_name') === 'cache-store-2-updated', 'old global key is never used');

foreach ([1, 2] as $owner) {
    foreach ([1, 2] as $id) {
        TenantContext::set($id);
        $cache->delectDbCache('open_adv');
    }
    Db::name('cache')->insert(['key' => 'open_adv', 'tenant_id' => $owner,
        'result' => json_encode(['legacy' => $owner]), 'expire_time' => 0, 'add_time' => time()]);
    TenantContext::set(3 - $owner);
    checkCache(!$cache->checkDbCache('open_adv'), 'legacy unavailable to other tenant');
    TenantContext::set($owner);
    checkCache($cache->getDbCache('open_adv', '') === ['legacy' => $owner], 'legacy owned read');
    checkCache($cache->checkDbCache('open_adv', ['legacy' => $owner]), 'legacy check');
    $cache->setDbCache('open_adv', ['owner' => $owner]);
    checkCache(Db::name('cache')->where('key', 'open_adv')->count() === 0, 'write retires legacy');
    checkCache($cache->getDbCache('open_adv', '') === ['owner' => $owner], 'new value after migration');
    $cache->delectDbCache('open_adv');
    checkCache(!$cache->checkDbCache('open_adv'), 'delete does not resurrect legacy');
    $cache->setDbCache('open_adv', ['expired' => true], -1);
    checkCache(!$cache->checkDbCache('open_adv'), 'expiry removes current advert');
    checkCache($cache->getDbCache('open_adv', function () use ($owner) { return ['owner' => $owner]; })
        === ['owner' => $owner], 'closure refresh after expiry');
}
$children = [];
foreach ([1, 2, 1, 2, 1, 2, 1, 2] as $id) {
    $pipes = [];
    $process = proc_open([PHP_BINARY, __FILE__, '--writer', (string)$id],
        [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    fclose($pipes[0]);
    $children[] = [$process, $pipes];
}
foreach ($children as [$process, $pipes]) {
    $out = stream_get_contents($pipes[1]);
    $err = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    checkCache(proc_close($process) === 0, 'concurrent writer ' . trim($out . $err));
}
foreach ([2, 1, 2, 1, 2, 1] as $id) {
    TenantContext::set($id);
    checkCache($cache->getDbCache('open_adv', '') === ['owner' => $id], 'concurrent result tenant ' . $id);
    checkCache(Db::name('cache')->where('key', TenantContext::key('open_adv'))->count() === 1, 'one physical row tenant ' . $id);
}
TenantContext::set(2);
$cache->delectDbCache('open_adv');
TenantContext::set(1);
checkCache($cache->checkDbCache('open_adv', ['owner' => 1]), 'delete tenant 2 preserves tenant 1');
TenantContext::set(2);
$cache->setDbCache('open_adv', ['owner' => 2]);
Db::name('cache')->where('key', TenantContext::key('open_adv'))->update(['tenant_id' => 1]);
try {
    $cache->setDbCache('open_adv', ['owner' => 2, 'changed' => true]);
    checkCache(false, 'reject physical key with wrong owner');
} catch (RuntimeException $error) {
    checkCache(Db::name('cache')->where('key', TenantContext::key('open_adv'))->value('result') === json_encode(['owner' => 2]), 'collision rolls back without overwrite');
} finally {
    Db::name('cache')->where('key', TenantContext::key('open_adv'))->update(['tenant_id' => 2]);
}
exit($failures ? 1 : 0);
