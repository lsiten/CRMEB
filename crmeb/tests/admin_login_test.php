<?php
require __DIR__ . '/tenant_bootstrap.php';
require __DIR__ . '/admin_login_fixture.php';

use think\facade\Db;
use crmeb\services\TenantContext;
use app\model\system\admin\SystemAdmin;

$pdo = new PDO('mysql:host=127.0.0.1;port=' . $port, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE DATABASE `' . $database . '`');
$server = null;
try {
    $password = seedAdminLogin();
    $base = startAdminHttp($server);
    $login = function (string $account, ?string $pwd = null) use ($base, $password): array {
        return adminHttp($base, 'login', ['account' => $account, 'pwd' => $pwd ?? $password]);
    };
    $row = Db::name('system_admin')->where('id', 11)->find();
    check(password_verify($password, $row['pwd']) && (int)$row['status'] === 1, 'B fixture password and status valid');
    TenantContext::clear();
    check(SystemAdmin::where('account', 'bravo')->find() === null, 'default scope hides B before authentication');
    $b = $login('bravo');
    echo 'B result tenant=' . ($b['data']['user_info']['tenant_id'] ?? 'none')
        . ' stored tenant=' . Db::name('system_admin')->where('id', 11)->value('tenant_id') . PHP_EOL;
    check($b['status'] === 200 && $b['data']['user_info']['tenant_id'] === 2, 'non-default B administrator logs in to original tenant');
    $saved = Db::name('system_admin')->where('id', 11)->find();
    check((int)$saved['tenant_id'] === 2 && (int)$saved['login_count'] === (int)$row['login_count'] + 1
        && (int)$saved['last_time'] > 0 && $saved['last_ip'] === '127.0.0.1', 'login saves timestamp/IP/count without moving B');
    $tokenB = $b['data']['token'];
    $profile = adminHttp($base, 'setting/info', null, $tokenB);
    check($profile['status'] === 200 && $profile['data']['id'] === 11 && $profile['data']['tenant_id'] === 2,
        'real setting/info returns original B administrator');
    $items = adminHttp($base, '__test/items?tenant_id=1', null, $tokenB);
    check($items['status'] === 200 && $items['data']['admin_id'] === 11
        && $items['data']['tenant_id'] === 2 && array_column($items['data']['items'], 'tenant_id') === [2], 'B login token reads only own ORM data');
    foreach ([10 => 'alpha', 12 => 'platform'] as $id => $account) {
        $result = $login($account);
        check($result['status'] === 200 && $result['data']['user_info']['id'] === $id, $account . ' login remains compatible');
    }
    $service = new \app\services\system\TenantCredentialServices();
    $credential = $service->generate(['level' => 0], 2);
    $own = adminHttp($base, 'tenant/credentials/2', null, $tokenB);
    check($own['status'] === 200 && $own['data']['client_id'] === $credential['client_id']
        && !isset($own['data']['app_secret']), 'B login token reads own credential without secret');
    check(adminHttp($base, 'tenant/credentials/1', null, $tokenB)['status'] === 403, 'B login token cannot read A credentials');
    $wrong = $login('bravo', 'incorrect-password');
    check($wrong['status'] === 400 && $wrong['msg'] === '账号或密码错误', 'wrong password rejected');
    Db::name('system_admin')->where('id', 11)->update(['status' => 0]);
    $disabled = $login('bravo');
    check($disabled['status'] === 400 && $disabled['msg'] === '您已被禁止登录', 'disabled B administrator rejected');
    Db::name('system_admin')->where('id', 11)->update(['status' => 1, 'is_del' => 1]);
    check($login('bravo')['status'] === 400, 'deleted B administrator rejected');
    Db::name('system_admin')->where('id', 11)->update(['is_del' => 0]);
    check(Db::name('system_admin')->where('id', 11)->find() === $saved, 'rejected logins do not change B metadata');

    // Existing create/edit checks are tenant-scoped and the account index is not unique.
    foreach ([1, 2] as $tenant) {
        TenantContext::set($tenant);
        check(app()->make(\app\services\system\admin\SystemAdminServices::class)->create([
            'account' => 'shared', 'pwd' => $password, 'conf_pwd' => $password, 'roles' => [], 'level' => 1,
        ]), 'existing create permits shared name in tenant ' . $tenant);
    }
    TenantContext::clear();
    $before = Db::name('system_admin')->where('account', 'shared')->select()->toArray();
    $shared = $login('shared');
    check($shared['status'] === 400 && $shared['msg'] === '账号或密码错误', 'ambiguous cross-tenant name fails closed even with same password');
    Db::name('system_admin')->where(['account' => 'shared', 'tenant_id' => 2])->update(['pwd' => password_hash('another-password', PASSWORD_BCRYPT)]);
    check($login('shared')['status'] === 400 && $login('shared', 'another-password')['status'] === 400,
        'ambiguous name never selects an account by first row or matching password');
    check(array_column(Db::name('system_admin')->where('account', 'shared')->select()->toArray(), 'login_count') === array_column($before, 'login_count'), 'ambiguous attempts do not save either account');
    foreach ([1 => ['a', $password], 2 => ['b', 'another-password']] as $tenantId => $input) {
        $prior = Db::name('system_admin')->where(['account' => 'shared', 'tenant_id' => $tenantId])->find();
        $result = adminHttp($base, 'login', ['account' => 'shared', 'pwd' => $input[1], 'tenant_code' => $input[0]]);
        check($result['status'] === 200 && $result['data']['user_info']['tenant_id'] === $tenantId,
            'shared account logs in to explicit tenant ' . $tenantId);
        $after = Db::name('system_admin')->where('id', $prior['id'])->find();
        check((int)$after['tenant_id'] === $tenantId && (int)$after['login_count'] === (int)$prior['login_count'] + 1
            && (int)$after['last_time'] > 0 && $after['last_ip'] === '127.0.0.1', 'explicit login preserves ownership and metadata');
    }
    $stable = Db::name('system_admin')->where('account', 'shared')->select()->toArray();
    foreach (['missing', 'a', ''] as $code) {
        $result = adminHttp($base, 'login', ['account' => 'shared', 'pwd' => 'another-password', 'tenant_code' => $code]);
        check($result['status'] === 400 && $result['msg'] === '账号或密码错误', 'wrong tenant/password or omitted selector rejects');
    }
    check(Db::name('system_admin')->where('account', 'shared')->select()->toArray() === $stable, 'selector failures do not update either account');
    foreach ([[], 1, null, str_repeat('x', 65)] as $code) {
        $result = adminHttp($base, 'login', ['account' => 'bravo', 'pwd' => $password, 'tenant_code' => $code]);
        check($result['status'] === 400, 'invalid tenant code input rejected');
    }
    foreach (['', '  ', ' b '] as $code) {
        check(adminHttp($base, 'login', ['account' => 'bravo', 'pwd' => $password, 'tenant_code' => $code])['status'] === 200,
            'empty or trimmed code stays compatible');
    }
    Db::name('tenant')->where('id', 2)->update(['status' => 0]);
    check(adminHttp($base, 'login', ['account' => 'shared', 'pwd' => 'another-password', 'tenant_code' => 'b'])['status'] === 400,
        'disabled selected tenant rejected');
    Db::name('tenant')->where('id', 2)->update(['status' => 1]);
    $duplicate = Db::name('system_admin')->where(['account' => 'shared', 'tenant_id' => 2])->find();
    unset($duplicate['id']);
    $duplicateId = Db::name('system_admin')->insertGetId($duplicate);
    check(adminHttp($base, 'login', ['account' => 'shared', 'pwd' => 'another-password', 'tenant_code' => 'b'])['status'] === 400,
        'same tenant duplicate rejected');
    Db::name('system_admin')->where('id', $duplicateId)->delete();
    Db::name('tenant')->insert(['id' => 3, 'name' => 'drift', 'code' => 'b', 'status' => 0]);
    check(adminHttp($base, 'login', ['account' => 'shared', 'pwd' => 'another-password', 'tenant_code' => 'b'])['status'] === 400,
        'duplicate tenant code under schema drift rejected');
    Db::name('tenant')->where('id', 3)->delete();
    Db::name('system_admin')->where(['account' => 'shared', 'tenant_id' => 1])->update(['is_del' => 1]);
    check($login('shared', 'another-password')['status'] === 200, 'deleted duplicate does not block unique B account');
    check(SystemAdmin::where('account', 'bravo')->find() === null && TenantContext::id() === 1,
        'authentication did not globally remove tenant scope');
    testRequest();
    $adminService = app()->make(\app\services\system\admin\SystemAdminServices::class);
    TenantContext::set(7, true);
    $verified = $adminService->verifyLogin('bravo', $password);
    check((int)$verified->tenant_id === 2 && TenantContext::id() === 7 && TenantContext::isCrossTenant(),
        'verifyLogin restores caller context after successful original-tenant save');
    Db::execute("CREATE TRIGGER reject_login_write BEFORE UPDATE ON eb_system_admin FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'isolated write failure'");
    $failedWrite = false;
    try { $adminService->verifyLogin('bravo', $password); }
    catch (\think\db\exception\PDOException $e) { $failedWrite = strpos($e->getMessage(), 'isolated write failure') !== false; }
    check($failedWrite && TenantContext::id() === 7 && TenantContext::isCrossTenant(),
        'write exception propagates and restores caller context');
    echo "All admin login checks passed.\n";
} finally {
    if (is_resource($server)) { proc_terminate($server); proc_close($server); }
    $pdo->exec('DROP DATABASE `' . $database . '`');
    TenantContext::clear();
}
