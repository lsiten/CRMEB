<?php
$scratch = getenv('TENANT_HEADER_SCRATCH');
$database = getenv('TENANT_HEADER_DATABASE');
if (!preg_match('/^lsit30_test_[a-f0-9]+$/D', $database) || !is_dir($scratch . '/app')) exit(2);
require $scratch . '/app/vendor/autoload.php';
$app = new think\App($scratch . '/app/');
$app->initialize();
if (config('database.connections.mysql.database') !== $database) exit(2);

use think\facade\Db;
use crmeb\services\TenantContext;
use crmeb\services\CacheService;
use crmeb\utils\JwtAuth;
use app\services\kefu\LoginServices;
use app\kefuapi\middleware\KefuAuthTokenMiddleware;

$passed = 0;
$failed = 0;
function checkKefu(bool $ok, string $label): void {
    global $passed, $failed;
    $ok ? ++$passed : ++$failed;
    echo ($ok ? 'PASS ' : 'FAIL ') . $label . PHP_EOL;
}
function httpKefu(string $path, ?array $body = null, string $token = ''): array {
    $ch = curl_init('http://127.0.0.1:' . getenv('TENANT_HEADER_HTTP_PORT') . '/kefuapi/' . $path);
    $headers = ['Content-Type: application/json'];
    if ($token !== '') $headers[] = 'Authori-zation: Bearer ' . $token;
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_HTTPHEADER => $headers]);
    if ($body !== null) curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body)]);
    $raw = curl_exec($ch);
    if ($raw === false) throw new RuntimeException(curl_error($ch));
    $http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['http' => $http, 'body' => json_decode($raw, true)];
}
function statusKefu(array $r, int $status, string $label, ?string $msg = null): void {
    checkKefu($r['http'] === 200 && ($r['body']['status'] ?? null) === $status &&
        ($msg === null || ($r['body']['msg'] ?? null) === $msg), $label . ' HTTP=' . $r['http'] . ' status=' . ($r['body']['status'] ?? 'missing') . ' msg=' . ($r['body']['msg'] ?? 'missing'));
}
$password = bin2hex(random_bytes(16));
$otherPassword = bin2hex(random_bytes(16));
$staff = [];
$records = [];
$fixture = json_decode(file_get_contents($scratch . '/fixture.json'), true);
foreach ([1, 2] as $id) {
    $uid = Db::name('user')->insertGetId(['tenant_id' => $id, 'account' => 'kefustaff' . $id,
        'pwd' => password_hash($password, PASSWORD_BCRYPT), 'nickname' => 'staff' . $id, 'status' => 1, 'add_time' => time()]);
    $staff[$id] = (int)Db::name('store_service')->insertGetId(['tenant_id' => $id, 'uid' => $uid,
        'account' => 'kefustaff' . $id, 'password' => password_hash($password, PASSWORD_BCRYPT), 'nickname' => 'staff' . $id, 'status' => 1]);
    checkKefu(password_verify($password, Db::name('store_service')->where('id', $staff[$id])->value('password')), 'seed password verified tenant ' . $id);
    foreach ([$id, 3 - $id] as $recordTenant) {
        $recordId = (int)Db::name('store_service_record')->insertGetId(['tenant_id' => $recordTenant, 'user_id' => $uid,
            'to_uid' => $fixture[$id]['uid'], 'message' => 'record tenant ' . $recordTenant, 'update_time' => time(), 'is_tourist' => 0]);
        if ($recordTenant === $id) $records[$id] = $recordId;
    }
    Db::name('store_service')->insert(['tenant_id' => $id, 'uid' => 0, 'account' => 'sharedstaff',
        'password' => password_hash($id === 1 ? $password : $otherPassword, PASSWORD_BCRYPT), 'nickname' => 'shared' . $id, 'status' => 1]);
}
$tokens = [];
foreach ([1, 2, 2, 1] as $id) {
    $r = httpKefu('login', ['account' => 'kefustaff' . $id, 'password' => $password]);
    statusKefu($r, 200, 'unique login tenant ' . $id);
    if (($r['body']['status'] ?? null) !== 200) continue;
    $token = $tokens[$id] = $r['body']['data']['token'];
    $jwt = app()->make(JwtAuth::class);
    [$tokenId, $type, , $tenant] = $jwt->parseToken($token);
    $jwt->verifyToken();
    checkKefu($tenant === $id && $type === 'kefu' && $tokenId === $staff[$id], 'signed JWT ownership ' . $id);
    checkKefu((int)$r['body']['data']['kefuInfo']['tenant_id'] === $id && !isset($r['body']['data']['kefuInfo']['password']), 'login envelope ownership and hidden password ' . $id);
    foreach (['service/info', 'user/record'] as $path) statusKefu(httpKefu($path, null, $token), 200, 'tenant ' . $id . ' ' . $path);
    $info = httpKefu('service/info', null, $token);
    checkKefu((int)($info['body']['data']['id'] ?? 0) === $staff[$id], 'info actual staff ' . $id);
    checkKefu(($info['body']['data']['site_name'] ?? null) === 'Header tenant ' . $id, 'info tenant config ' . $id);
    $override = httpKefu('service/info?tenant_id=' . (3 - $id) . '&tenant_code=unknown', null, $token);
    checkKefu((int)($override['body']['data']['tenant_id'] ?? 0) === $id, 'request cannot override signed tenant ' . $id);
    $record = httpKefu('user/record', null, $token);
    $rows = $record['body']['data'] ?? [];
    checkKefu(count($rows) === 1 && (int)$rows[0]['id'] === $records[$id] && (int)$rows[0]['tenant_id'] === $id,
        'record actual tenant rows (foreign row same user_id excluded) ' . $id);
}
foreach ([null, 1, true, [], ['x'], str_repeat('a', 65), str_repeat('租', 65)] as $code) {
    statusKefu(httpKefu('login', ['account' => 'kefustaff1', 'password' => $password, 'tenant_code' => $code]), 400, 'invalid tenant_code ' . gettype($code), '租户编码格式错误');
}
foreach (['', '   ', ' default '] as $code) statusKefu(httpKefu('login', ['account' => 'kefustaff1', 'password' => $password, 'tenant_code' => $code]), 200, 'empty/trim code ' . json_encode($code));
foreach (['default', 'header-b'] as $i => $code) {
    $r = httpKefu('login', ['account' => 'sharedstaff', 'password' => $i === 0 ? $password : $otherPassword, 'tenant_code' => ' ' . $code . ' ']);
    statusKefu($r, 200, 'same account explicit ' . $code);
    checkKefu((int)($r['body']['data']['kefuInfo']['tenant_id'] ?? 0) === $i + 1, 'same account selected tenant ' . $code);
}
foreach ([[], ['tenant_code' => ''], ['tenant_code' => 'unknown'], ['tenant_code' => 'header-b']] as $extra) {
    statusKefu(httpKefu('login', $extra + ['account' => 'sharedstaff', 'password' => $password]), 400, 'no password guessing/no fallback ' . json_encode($extra), '账号或密码错误');
}
statusKefu(httpKefu('login', ['account' => 'kefustaff2', 'password' => $password, 'tenant_code' => 'default']), 400, 'wrong existing code', '账号或密码错误');
statusKefu(httpKefu('login', ['account' => 'kefustaff1', 'password' => 'wrong']), 400, 'wrong password', '账号或密码错误');
statusKefu(httpKefu('login', ['account' => 'missingstaff', 'password' => $password]), 400, 'missing account', '账号或密码错误');
foreach (['', 'invalid'] as $token) statusKefu(httpKefu('service/info', null, $token), 402, 'missing/malformed bearer');
Db::name('tenant')->where('id', 2)->update(['status' => 0]);
foreach (['', 'header-b'] as $code) statusKefu(httpKefu('login', ['account' => 'kefustaff2', 'password' => $password, 'tenant_code' => $code]), 400, 'disabled tenant ' . $code, '账号或密码错误');
if (isset($tokens[2])) statusKefu(httpKefu('service/info', null, $tokens[2]), 402, 'disabled tenant old token');
Db::name('tenant')->where('id', 2)->update(['status' => 1]);
Db::name('store_service')->where('id', $staff[2])->update(['status' => 0]);
statusKefu(httpKefu('login', ['account' => 'kefustaff2', 'password' => $password]), 400, 'disabled staff', '账号或密码错误');
if (isset($tokens[2])) statusKefu(httpKefu('user/record', null, $tokens[2]), 402, 'disabled staff old token');
Db::name('store_service')->where('id', $staff[2])->update(['status' => 1]);

$jwt = app()->make(JwtAuth::class);
foreach (['admin', 'api'] as $type) {
    $token = $jwt->createToken($staff[1], $type, ['tenant_id' => 1])['token'];
    statusKefu(httpKefu('service/info', null, $token), 402, 'reject signed ' . $type . ' token');
}
foreach ([null, 0, -1, '2', 2.5, true, [], 999] as $tenant) {
    $token = $jwt->createToken($staff[2], 'kefu', ['tenant_id' => $tenant])['token'];
    statusKefu(httpKefu('service/info', null, $token), 402, 'reject invalid tenant claim ' . json_encode($tenant));
}
foreach ([1, 2] as $id) {
    $token = $jwt->createToken($staff[$id], 'kefu')['token'];
    statusKefu(httpKefu('service/info', null, $token), $id === 1 ? 200 : 402, 'legacy missing claim tenant ' . $id);
}
$token = $jwt->createToken($staff[2], 'kefu', ['tenant_id' => 1])['token'];
statusKefu(httpKefu('service/info', null, $token), 402, 'wrong signed account ownership');
$token = $jwt->createToken($staff[1], 'kefu', ['tenant_id' => 1, 'iat' => time() - 7200, 'exp' => time() - 3600])['token'];
statusKefu(httpKefu('service/info', null, $token), 402, 'expired signed token');
$token = $jwt->createToken($staff[2], 'kefu', ['tenant_id' => 2])['token'];
$parts = explode('.', $token);
$parts[2][0] = $parts[2][0] === 'a' ? 'b' : 'a';
$forged = implode('.', $parts);
CacheService::set(md5($forged), ['uid' => $staff[2], 'type' => 'kefu', 'token' => $forged], 600, 'kefu');
statusKefu(httpKefu('service/info', null, $forged), 402, 'invalid signature even with bucket');
CacheService::set(md5($token), ['uid' => $staff[1], 'type' => 'kefu', 'token' => $token], 600, 'kefu');
statusKefu(httpKefu('service/info', null, $token), 402, 'bucket identity mismatch');
foreach ([['type' => 'admin', 'token' => $token], ['type' => 'kefu', 'token' => 'different']] as $fields) {
    CacheService::set(md5($token), ['uid' => $staff[2]] + $fields, 600, 'kefu');
    statusKefu(httpKefu('service/info', null, $token), 402, 'bucket type/token mismatch');
}
CacheService::delete(md5($token));
statusKefu(httpKefu('service/info', null, $token), 402, 'revoked valid token');

$services = app()->make(LoginServices::class);
foreach ([1, 2] as $id) {
    TenantContext::set($id);
    try {
        $byId = $services->loginById($staff[$id]);
        checkKefu((int)$byId['kefuInfo']['id'] === $staff[$id] && (int)$byId['kefuInfo']['tenant_id'] === $id, 'authenticated internal ID login ' . $id);
    } catch (Throwable $e) { checkKefu(false, 'authenticated internal ID login ' . $id . ' ' . $e->getMessage()); }
    try { $services->loginById($staff[3 - $id]); checkKefu(false, 'foreign internal ID login denied'); }
    catch (Throwable $e) { checkKefu($e instanceof crmeb\exceptions\AuthException, 'foreign internal ID login denied'); }
    checkKefu(TenantContext::id() === $id, 'internal ID login context preserved');
}
foreach ([false, true] as $cross) {
    TenantContext::bindClient(1);
    TenantContext::set(1, $cross);
    foreach ([$password, 'wrong'] as $pwd) {
        try { $services->authLogin('kefustaff2', $pwd, 'header-b'); } catch (Throwable $e) {}
        checkKefu(TenantContext::id() === 1 && TenantContext::isCrossTenant() === $cross && TenantContext::clientId() === 1, 'login restores context cross=' . (int)$cross);
    }
    $token = $jwt->createToken($staff[2], 'kefu', ['tenant_id' => 2])['token'];
    try { $parsed = $services->parseToken($token); checkKefu((int)$parsed['tenant_id'] === 2, 'parse selects trusted tenant'); }
    catch (Throwable $e) { checkKefu(false, 'parse trusted tenant: ' . $e->getMessage()); }
    checkKefu(TenantContext::id() === 1 && TenantContext::isCrossTenant() === $cross, 'parse restores context');
    foreach ([false, true] as $throws) {
        $request = new app\Request();
        $request->withHeader(['Authori-zation' => 'Bearer ' . $token]);
        try {
            (new KefuAuthTokenMiddleware())->handle($request, function ($request) use ($throws, $staff) {
                checkKefu(TenantContext::id() === 2 && !TenantContext::isCrossTenant() && $request->kefuId() === $staff[2], 'downstream trusted scoped tenant');
                if ($throws) throw new RuntimeException('downstream fixture');
                return 'ok';
            });
        } catch (Throwable $e) { checkKefu($throws && $e->getMessage() === 'downstream fixture', 'downstream exception propagates'); }
        checkKefu(TenantContext::id() === 1 && TenantContext::isCrossTenant() === $cross && TenantContext::clientId() === 1, 'middleware restores context throws=' . (int)$throws);
    }
}
TenantContext::clear();
TenantContext::set(2);
$scanKey = bin2hex(random_bytes(16));
Db::name('store_service')->where(['account' => 'sharedstaff', 'tenant_id' => 2])->update(['uniqid' => $scanKey]);
CacheService::set($scanKey, '0', 600);
$scan = $services->scanLogin($scanKey);
checkKefu(($scan['status'] ?? null) === 3 && (int)($scan['kefuInfo']['tenant_id'] ?? 0) === 2,
    'existing scan uses confirmed row despite cross tenant same account');
checkKefu(!CacheService::has($scanKey) && TenantContext::id() === 2, 'scan consumes key and preserves caller context');
try { $services->authLogin('kefustaff2'); checkKefu(false, 'passwordless public service call rejected'); }
catch (Throwable $e) { checkKefu($e instanceof crmeb\exceptions\AuthException, 'passwordless public service call rejected'); }
TenantContext::clear();
// Exercise exceptions after binding, with a token writer failure confined to this test process.
$broken = new class(app()->make(app\dao\service\StoreServiceDao::class)) extends LoginServices {
    public function createToken(int $id, $type, $pwd = '') {
        checkKefu(TenantContext::id() === 2 && !TenantContext::isCrossTenant(), 'login token writer bound to tenant 2');
        throw new RuntimeException('token writer fixture');
    }
};
TenantContext::set(1, true);
try { $broken->authLogin('kefustaff2', $password, 'header-b'); checkKefu(false, 'token writer exception expected'); }
catch (Throwable $e) { checkKefu($e->getMessage() === 'token writer fixture', 'token writer exception propagates'); }
checkKefu(TenantContext::id() === 1 && TenantContext::isCrossTenant(), 'login restores context after token writer failure');
foreach (['', $forged] as $badToken) {
    try { $services->parseToken($badToken); checkKefu(false, 'invalid parse expected'); }
    catch (Throwable $e) { checkKefu($e instanceof crmeb\exceptions\AuthException, 'invalid parse rejection'); }
    checkKefu(TenantContext::id() === 1 && TenantContext::isCrossTenant(), 'invalid parse restores context');
}
TenantContext::clear();
Db::name('store_service')->insert(['tenant_id' => 2, 'uid' => 0, 'account' => 'kefustaff2',
    'password' => password_hash($otherPassword, PASSWORD_BCRYPT), 'nickname' => 'duplicate', 'status' => 1]);
statusKefu(httpKefu('login', ['account' => 'kefustaff2', 'password' => $password, 'tenant_code' => 'header-b']), 400, 'same tenant duplicate rejects before password', '账号或密码错误');
Db::name('store_service')->where(['account' => 'sharedstaff', 'tenant_id' => 2])->update(['status' => 0]);
statusKefu(httpKefu('login', ['account' => 'sharedstaff', 'password' => $password]), 200, 'unique active account ignores disabled duplicate');
Db::name('tenant')->insert(['id' => 3, 'name' => 'boundary', 'code' => str_repeat('租', 64), 'status' => 1]);
statusKefu(httpKefu('login', ['account' => 'missingstaff', 'password' => $password, 'tenant_code' => ' ' . str_repeat('租', 64) . ' ']), 400, '64 unicode chars accepted then account rejected', '账号或密码错误');
Db::execute('ALTER TABLE eb_tenant DROP INDEX code');
Db::name('tenant')->insert(['id' => 4, 'name' => 'ambiguous', 'code' => 'default', 'status' => 1]);
statusKefu(httpKefu('login', ['account' => 'kefustaff1', 'password' => $password, 'tenant_code' => 'default']), 400, 'duplicate tenant code schema drift rejected', '账号或密码错误');
foreach ([1, 2] as $id) checkKefu((int)Db::name('store_service')->where('id', $staff[$id])->value('tenant_id') === $id, 'login writes preserve tenant ' . $id);
echo "RESULT passed=$passed failed=$failed\n";
exit($failed === 0 ? 0 : 1);
