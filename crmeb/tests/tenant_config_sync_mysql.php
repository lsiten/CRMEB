<?php
/** Run only against a disposable installation upgraded with tenant:upgrade. */
$expectedDatabase = getenv('TENANT_CONFIG_TEST_DATABASE') ?: '';
if (!preg_match('/^lsit21_config_test_[a-z0-9_]+$/D', $expectedDatabase)) {
    fwrite(STDERR, "Set TENANT_CONFIG_TEST_DATABASE to an isolated lsit21_config_test_* database.\n");
    exit(2);
}
require dirname(__DIR__) . '/vendor/autoload.php';
$app = new think\App(dirname(__DIR__) . '/');
$app->initialize();

use app\services\system\config\TenantConfigServices;
use think\facade\Db;

$database = (string)Db::query('SELECT DATABASE() AS name')[0]['name'];
if ($expectedDatabase !== $database) {
    fwrite(STDERR, "Refusing database: use a new lsit21_config_test_* database and explicitly opt in.\n");
    exit(2);
}

function checkConfigSync(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
    echo "PASS: {$message}\n";
}

$tables = ['system_config', 'system_group_data', 'system_timer', 'system_notification',
    'system_user_level', 'system_event_data', 'theme'];
Db::startTrans();
$failed = false;
try {
    $target = (int)Db::name('tenant')->insertGetId([
        'name' => 'Config regression', 'code' => 'config-regression-' . bin2hex(random_bytes(6)),
        'status' => 1, 'add_time' => time(),
    ]);
    $sources = [];
    foreach ($tables as $table) {
        $sources[$table] = Db::name($table)->where('tenant_id', 1)->order('id')->select()->toArray();
    }
    $custom = $sources['system_config'][0];
    unset($custom['id']);
    $custom['tenant_id'] = $target;
    $custom['value'] = '"tenant-specific-value"';
    Db::name('system_config')->insert($custom);
    $service = $app->make(TenantConfigServices::class);
    checkConfigSync($service->syncTenant($target) > 0, 'copies complete configuration without field errors');
    $snapshots = [];
    foreach ($tables as $table) {
        $snapshots[$table] = Db::name($table)->where('tenant_id', $target)->order('id')->select()->toArray();
        checkConfigSync(count($snapshots[$table]) > 0 || count($sources[$table]) === 0, $table . ' copied');
        $normalize = static function (array $row): string {
            unset($row['id'], $row['tenant_id']);
            ksort($row);
            return json_encode($row, JSON_UNESCAPED_UNICODE);
        };
        $expected = $sources[$table];
        if ($table === 'system_config') $expected[0]['value'] = $custom['value'];
        checkConfigSync(!array_diff(array_map($normalize, $expected), array_map($normalize, $snapshots[$table])), $table . ' complete row values retained');
        checkConfigSync($sources[$table] === Db::name($table)->where('tenant_id', 1)->order('id')->select()->toArray(), $table . ' source unchanged');
    }
    $values = Db::name('system_config')->where('tenant_id', $target)
        ->where('menu_name', $custom['menu_name'])->where('config_tab_id', $custom['config_tab_id'])->column('value');
    checkConfigSync($values === [$custom['value']], 'existing tenant value preserved without duplicate');
    checkConfigSync($service->syncTenant($target) === 0, 'second sync is idempotent');
    foreach ($tables as $table) {
        checkConfigSync($snapshots[$table] === Db::name($table)->where('tenant_id', $target)->order('id')->select()->toArray(), $table . ' repeat unchanged');
    }
    checkConfigSync($service->syncTenant(1) === 0 && $service->syncTenant(0) === 0, 'source and invalid target are no-ops');
} catch (Throwable $error) {
    fwrite(STDERR, get_class($error) . ': ' . $error->getMessage() . PHP_EOL);
    $failed = true;
} finally {
    Db::rollback();
}
exit($failed ? 1 : 0);
