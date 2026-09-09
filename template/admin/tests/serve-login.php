<?php
// Test-only driver; server checkout and all database/cache state must be isolated.
$root = getenv('ADMIN_LOGIN_SERVER');
require $root . '/crmeb/tests/tenant_bootstrap.php';
require $root . '/crmeb/tests/admin_login_fixture.php';

$pdo = new PDO('mysql:host=127.0.0.1;port=' . $port, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE `' . $database . '`');
$server = null;
try {
    $password = seedAdminLogin();
    foreach ([1, 2] as $tenant) {
        \think\facade\Db::name('system_admin')->insert([
            'account' => 'shared', 'tenant_id' => $tenant, 'level' => 1,
            'pwd' => password_hash($password, PASSWORD_BCRYPT),
        ]);
    }
    $base = startAdminHttp($server);
    echo json_encode(['base' => $base, 'password' => $password]) . PHP_EOL;
    while (!file_exists(getenv('TENANT_TEST_CACHE') . '/stop')) {
        usleep(100000);
    }
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    $pdo->exec('DROP DATABASE `' . $database . '`');
}
