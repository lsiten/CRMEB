<?php
$scratch = getenv('TENANT_HEADER_SCRATCH') ?: '';
$database = getenv('TENANT_HEADER_DATABASE') ?: '';
if (!preg_match('/^lsit30_test_[a-f0-9]+$/D', $database) || !is_dir($scratch . '/app')) exit(2);
require $scratch . '/app/vendor/autoload.php';
$app = new think\App($scratch . '/app/');
$app->initialize();
if (config('database.connections.mysql.database') !== $database
    || (int)config('database.connections.mysql.hostport') === 3306) exit(2);

use app\dao\other\CacheDao;
use app\services\other\CacheServices;
use crmeb\services\TenantContext;
use think\facade\Db;

$failures = 0;
function verifyInitialization(bool $ok, string $label): void
{
    global $failures;
    echo ($ok ? 'PASS ' : 'FAIL ') . $label . PHP_EOL;
    if (!$ok) ++$failures;
}

class InterleavedAdvertisementDao extends CacheDao
{
    public $afterMiss;
    public function value($where, ?string $field = '')
    {
        $result = parent::value($where, $field);
        if ($result === null && $this->afterMiss) {
            $save = $this->afterMiss;
            $this->afterMiss = null;
            $save();
        }
        return $result;
    }
}

$cache = new CacheServices(new CacheDao());
foreach (['kf_adv', 'open_adv'] as $key) {
    foreach ([1, 2] as $owner) {
        TenantContext::set($owner);
        $cache->delectDbCache($key);
        $cache->setDbCache($key, 'serial-control');
        verifyInitialization($cache->getDbCache($key, '') === 'serial-control', "$key/$owner serial control");
        foreach ([false, true] as $legacy) {
            foreach (['between-reads', 'during-closure'] as $schedule) {
                $cache->delectDbCache($key);
                if ($legacy) {
                    Db::name('cache')->insert(['key' => $key, 'tenant_id' => $owner,
                        'result' => json_encode('legacy-old'), 'expire_time' => 0, 'add_time' => time()]);
                }
                $label = "$key/$owner/" . ($legacy ? 'migration' : 'cold') . "/$schedule";
                $save = function () use ($cache, $key, $label) {
                    $cache->setDbCache($key, 'admin-new', 120);
                    verifyInitialization(Db::name('cache')->where('key', TenantContext::key($key))
                        ->value('result') === json_encode('admin-new'), "$label save committed");
                };
                $dao = new InterleavedAdvertisementDao();
                if ($schedule === 'between-reads') {
                    $dao->afterMiss = $save;
                    $default = '';
                } else {
                    // Expired legacy data must not bypass the refresh closure.
                    if ($legacy) Db::name('cache')->where('key', $key)->update(['expire_time' => time() - 1]);
                    $default = function () use ($save) { $save(); return 'stale-default'; };
                }
                $response = (new CacheServices($dao))->getDbCache($key, $default);
                $row = Db::name('cache')->where('key', TenantContext::key($key))->find();
                echo 'OBSERVED ' . $label . ' response=' . json_encode($response)
                    . ' stored=' . $row['result'] . PHP_EOL;
                verifyInitialization($response === 'admin-new', "$label reader returns saved value");
                verifyInitialization($row['result'] === json_encode('admin-new')
                    && (int)$row['expire_time'] > time(), "$label initialization preserves value and expiry");
                verifyInitialization(Db::name('cache')->where('key', $key)->count() === 0, "$label legacy retired");
            }
        }
        $cache->delectDbCache($key);
        verifyInitialization($cache->getDbCache($key, '') === '', "$key/$owner empty initialization");
        verifyInitialization($cache->getDbCache($key, 'replacement') === '', "$key/$owner existing empty retained");
        $cache->delectDbCache($key);
        verifyInitialization($cache->getDbCache($key, function () { return null; }) === null,
            "$key/$owner null closure unchanged");
        verifyInitialization(Db::name('cache')->where('key', TenantContext::key($key))->count() === 0,
            "$key/$owner null closure does not create row");
        Db::name('cache')->insert(['key' => $key, 'tenant_id' => 3 - $owner,
            'result' => json_encode('other-legacy'), 'expire_time' => 0, 'add_time' => time()]);
        verifyInitialization($cache->getDbCache($key, 'own-default') === 'own-default',
            "$key/$owner initializes without reading other legacy");
        verifyInitialization(Db::name('cache')->where('key', $key)->value('result') === json_encode('other-legacy'),
            "$key/$owner initialization preserves other legacy");
        Db::name('cache')->where('key', $key)->delete();
        Db::name('cache')->where('key', TenantContext::key($key))->update(['tenant_id' => 3 - $owner]);
        $before = Db::name('cache')->where('key', TenantContext::key($key))->find();
        try {
            $cache->getDbCache($key, 'wrong-owner-overwrite');
            verifyInitialization(false, "$key/$owner initialization rejects wrong owner");
        } catch (RuntimeException $e) {
            verifyInitialization(Db::name('cache')->where('key', TenantContext::key($key))->find() === $before,
                "$key/$owner initialization rejects wrong owner without changes");
        }
        Db::name('cache')->where('key', TenantContext::key($key))->delete();
    }
}
echo 'RESULT initialization failures=' . $failures . ' (deterministic real-DB scheduling, not HTTP concurrency)' . PHP_EOL;
exit($failures ? 1 : 0);
