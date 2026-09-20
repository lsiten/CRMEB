<?php
$scratch = getenv('TENANT_HEADER_SCRATCH') ?: '';
$database = getenv('TENANT_HEADER_DATABASE') ?: '';
if (!preg_match('/^lsit30_test_[a-f0-9]+$/D', $database) || !is_dir($scratch . '/app')) exit(2);
require $scratch . '/app/vendor/autoload.php';
$app = new think\App($scratch . '/app/');
$app->initialize();
if (config('database.connections.mysql.database') !== $database) exit(2);
use think\facade\Db;
use crmeb\services\TenantContext;
use app\services\system\TenantCredentialServices;

function assertHeader(bool $condition, string $label): void {
    if (!$condition) throw new RuntimeException('FAIL ' . $label);
    echo 'PASS ' . $label . PHP_EOL;
}
set_exception_handler(function (Throwable $e) { fwrite(STDERR, $e->getMessage() . PHP_EOL); exit(1); });
if (($argv[1] ?? '') === 'seed') {
    Db::name('tenant')->insert(['id' => 2, 'name' => 'Header B', 'code' => 'header-b', 'status' => 1, 'add_time' => time()]);
    app()->make(app\services\system\config\TenantConfigServices::class)->syncTenant(2);
    $fixture = [];
    foreach ([1, 2] as $id) {
        TenantContext::set($id);
        $fixture[$id] = app()->make(TenantCredentialServices::class)->generate(['level' => 0], $id);
        app()->make(app\services\system\config\SystemConfigServices::class)->update(['menu_name' => 'site_name'], ['value' => json_encode('Header tenant ' . $id)]);
        app()->make(app\services\other\CacheServices::class)->setDbCache('open_adv', ['tenant_marker' => $id]);
        $product = Db::name('store_product')->where('id', 1)->find();
        if (!$product) $product = ['image' => '', 'store_name' => 'header product', 'price' => '1.00', 'stock' => 10, 'is_show' => 1, 'is_del' => 0];
        unset($product['id']);
        $product['tenant_id'] = $id;
        $product['store_name'] = 'Header product ' . $id;
        $product['is_show'] = 1;
        $product['is_del'] = 0;
        $fixture[$id]['product_id'] = Db::name('store_product')->insertGetId($product);
        $uid = Db::name('user')->insertGetId(['tenant_id' => $id, 'account' => 'header-user-' . $id,
            'pwd' => password_hash('isolated-user-password', PASSWORD_BCRYPT), 'nickname' => 'Header user ' . $id,
            'status' => 1, 'is_del' => 0, 'avatar' => 'https://example.test/avatar.png', 'add_time' => time(), 'last_time' => 0]);
        $fixture[$id]['uid'] = $uid;
        $fixture[$id]['user_token'] = app()->make(crmeb\utils\JwtAuth::class)->createToken($uid, 'api', ['tenant_id' => $id])['token'];
        $fixture[$id]['old_token'] = app()->make(TenantCredentialServices::class)->exchange($fixture[$id])['tenant_token'];
    }
    file_put_contents($scratch . '/fixture.json', json_encode($fixture));
    chmod($scratch . '/fixture.json', 0600);
    echo "PASS isolated two-tenant seed\n";
    exit;
}
$fixture = json_decode(file_get_contents($scratch . '/fixture.json'), true);
$base = 'http://127.0.0.1:' . getenv('TENANT_HEADER_HTTP_PORT');
function httpHeader(string $path, array $headers = [], string $method = 'GET', ?array $body = null): array {
    global $base;
    $ch = curl_init($base . $path);
    $received = [];
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => array_merge(['Origin: https://client.example', 'Content-Type: application/json'], $headers),
        CURLOPT_HEADERFUNCTION => function ($ch, $line) use (&$received) { $received[] = trim($line); return strlen($line); }]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    $raw = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['http' => $status, 'body' => json_decode($raw, true), 'raw' => $raw, 'headers' => implode("\n", $received)];
}
function tenantHeaders(array $row): array { return ['appid: ' . $row['client_id'], 'screct_id: ' . $row['app_secret']]; }
function noData(array $response, string $code, string $label): void {
    assertHeader(($response['body']['data'] ?? null) === ['code' => $code], $label . ' no business data');
    assertHeader(stripos($response['headers'], 'Cache-Control: no-store') !== false && stripos($response['headers'], 'Access-Control-Allow-Origin: https://client.example') !== false, $label . ' CORS/no-store');
}
$paths = ['/api/version', '/api/basic_config', '/api/products', '/api/v2/diy/get_diy/1', '/api/pc/get_appid',
    '/api/login', '/api/upload/image', '/api/order/create/test', '/kefuapi/tourist/adv', '/kefuapi/tourist/feedback',
    '/kefuapi/tourist/chat', '/kefuapi/tourist/upload', '/surl/1', '/', '/api/get_script', '/api/service_pay_result'];
$variants = [[], ['appid: ' . $fixture[1]['client_id']], ['screct_id: ' . $fixture[1]['app_secret']],
    ['X-Tenant-Token: ' . $fixture[1]['old_token']], ['Authorization: Bearer ' . $fixture[1]['user_token']]];
$tables = ['user', 'store_order', 'store_product', 'user_address', 'store_service_feedback', 'system_attachment'];
$before = [];
foreach ($tables as $table) {
    try { $before[$table] = Db::name($table)->select()->toArray(); } catch (Throwable $e) { }
}
$app->cache->store('redis')->clear();
Db::execute("SET GLOBAL log_output = 'TABLE'");
Db::execute('SET GLOBAL general_log = ON');
$auditStart = Db::query('SELECT NOW(6) AS stamp')[0]['stamp'];
$routeCount = 0;
foreach (array_slice(file(__DIR__ . '/tenant_header_routes.tsv', FILE_IGNORE_NEW_LINES), 1) as $line) {
    [$method, $path, $policy] = explode("\t", $line);
    $path = preg_replace('/:[a-zA-Z_][a-zA-Z_0-9]*/', '1', $path);
    $response = httpHeader($path, [], $method === 'ANY' ? 'POST' : $method);
    assertHeader($policy === 'closed_protocol_503' ? $response['http'] === 503 :
        ($response['body']['data'] ?? null) === ['code' => 'tenant_auth_required'], 'route gate ' . $method . ' ' . $path . ' HTTP ' . $response['http'] . ' ' . substr(\crmeb\utils\SensitiveData::redact($response['raw']), 0, 180));
    ++$routeCount;
}
assertHeader($routeCount === 373, 'all 373 declarations traversed without credentials');
foreach ($paths as $path) foreach ($variants as $index => $headers) {
    noData(httpHeader($path, $headers, in_array($path, ['/api/login', '/api/upload/image', '/api/order/create/test', '/kefuapi/tourist/upload'], true) ? 'POST' : 'GET'), 'tenant_auth_required', $path . ' case ' . $index);
}
noData(httpHeader('/api/products', [], 'GET', ['appid' => $fixture[1]['client_id'], 'screct_id' => $fixture[1]['app_secret']]), 'tenant_auth_required', 'JSON alone');
noData(httpHeader('/api/tenant/token', [], 'POST', $fixture[1]), 'tenant_auth_required', 'legacy exchange body alone');
noData(httpHeader('/api/tenant/bootstrap', [], 'POST', ['entry' => 'store-a']), 'tenant_auth_required', 'anonymous bootstrap');
noData(httpHeader('/api/products', ['appid: malformed', 'screct_id: malformed']), 'tenant_credentials_invalid', 'audited malformed credentials');
noData(httpHeader('/api/products', ['appid: ' . $fixture[1]['client_id'], 'screct_id: ' . $fixture[2]['app_secret']]), 'tenant_credentials_invalid', 'audited mismatched pair');
Db::name('tenant')->where('id', 2)->update(['status' => 0]);
noData(httpHeader('/api/products', tenantHeaders($fixture[2])), 'tenant_credentials_invalid', 'audited disabled tenant');
Db::name('tenant')->where('id', 2)->update(['status' => 1]);
Db::execute('SET GLOBAL general_log = OFF');
$queries = Db::query('SELECT argument FROM mysql.general_log WHERE event_time >= ? AND command_type = ?', [$auditStart, 'Query']);
$businessQueries = array_filter($queries, function ($row) { return (bool)preg_match('/\beb_(?!tenant(?:_credential)?\b)[a-z_]+/i', $row['argument']); });
assertHeader(count($businessQueries) === 0, 'negative HTTP requests issue zero business SQL');
foreach ([1, 2] as $id) {
    TenantContext::set($id);
    $fixture[$id]['user_token'] = app()->make(crmeb\utils\JwtAuth::class)->createToken($fixture[$id]['uid'], 'api', ['tenant_id' => $id])['token'];
}
foreach ($before as $table => $rows) assertHeader(Db::name($table)->select()->toArray() === $rows, 'rejections unchanged ' . $table);
foreach ([1, 2, 1, 2] as $id) {
    $headers = tenantHeaders($fixture[$id]);
    $response = httpHeader('/api/basic_config', $headers);
    if (($response['body']['data']['site_name'] ?? '') !== 'Header tenant ' . $id) {
        fwrite(STDERR, 'Config diagnostic: ' . substr(\crmeb\utils\SensitiveData::redact($response['raw']), 0, 1200) . PHP_EOL);
    }
    assertHeader(($response['body']['data']['site_name'] ?? '') === 'Header tenant ' . $id, 'real FPM config tenant ' . $id . ' status=' . ($response['body']['status'] ?? $response['http']));
    $response = httpHeader('/api/get_open_adv', $headers);
    assertHeader(($response['body']['data'] ?? []) === ['tenant_marker' => $id], 'advert tenant ' . $id);
    $response = httpHeader('/api/products', $headers);
    $ids = array_column($response['body']['data'] ?? [], 'id');
    assertHeader(in_array($fixture[$id]['product_id'], $ids) && !in_array($fixture[3-$id]['product_id'], $ids), 'products tenant ' . $id);
    $response = httpHeader('/api/tenant/token', $headers, 'POST', ['client_id' => $fixture[3-$id]['client_id']]);
    assertHeader(($response['body']['data']['tenant']['id'] ?? 0) === $id, 'exchange uses headers only ' . $id);
    $feedback = httpHeader('/kefuapi/tourist/feedback', $headers, 'POST', ['rela_name' => 'Header test', 'phone' => '13800000000', 'content' => 'tenant feedback ' . $id]);
    assertHeader(($feedback['body']['status'] ?? 0) === 200, 'feedback write tenant ' . $id);
    assertHeader((int)Db::name('store_service_feedback')->where('content', 'tenant feedback ' . $id)->order('id', 'desc')->value('tenant_id') === $id, 'feedback persisted tenant ' . $id);
}
noData(httpHeader('/api/tenant/bootstrap', tenantHeaders($fixture[1]), 'POST', ['entry' => 'store-a']), 'tenant_bootstrap_unavailable', 'authenticated bootstrap disabled');
noData(httpHeader('/api/products?appid=parameter-only&screct_id=parameter-only'), 'tenant_auth_required', 'query cannot authenticate');
assertHeader((httpHeader('/api/version', ['ApPiD: ' . $fixture[1]['client_id'], 'ScReCt_Id: ' . $fixture[1]['app_secret']])['body']['status'] ?? 0) === 200, 'mixed case wire headers');
noData(httpHeader('/api/products', array_merge(tenantHeaders($fixture[1]), ['appid: duplicate'])), 'tenant_credentials_invalid', 'duplicate appid');
noData(httpHeader('/api/products', ['appid: malformed', 'screct_id: malformed']), 'tenant_credentials_invalid', 'malformed pair');
$base = 'http://127.0.0.1:' . getenv('TENANT_HEADER_NO_UNDERSCORE_PORT');
noData(httpHeader('/api/version', tenantHeaders($fixture[1])), 'tenant_auth_required', 'Nginx underscores off drops secret header');
$base = 'http://127.0.0.1:' . getenv('TENANT_HEADER_HTTP_PORT');
foreach (['/index.php?s=/api/products', '/API/products', '/api/products/', '/api/products.html'] as $path) {
    $response = httpHeader($path);
    assertHeader(($response['body']['data'] ?? null) === ['code' => 'tenant_auth_required'] || $response['http'] === 404, 'path variant closed ' . $path);
}
noData(httpHeader('/api/products?tenant_id=2', tenantHeaders($fixture[1])), 'tenant_mismatch', 'explicit tenant conflict');
noData(httpHeader('/api/products', ['appid: ' . $fixture[1]['client_id'], 'screct_id: ' . $fixture[2]['app_secret']]), 'tenant_credentials_invalid', 'wrong secret');
$response = httpHeader('/api/products', array_merge(tenantHeaders($fixture[1]), ['Authorization: Bearer ' . $fixture[2]['user_token']]));
assertHeader(($response['body']['status'] ?? 0) === 403, 'cross tenant user denied');
assertHeader(($response['body']['data']['code'] ?? '') === 'tenant_mismatch', 'cross tenant user machine code');
foreach (['/api/version', '/api/v2/unknown', '/api/pc/unknown', '/kefuapi/tourist/adv', '/surl/1'] as $path) {
    $response = httpHeader($path, [], 'OPTIONS');
    assertHeader($response['http'] === 200 && stripos($response['headers'], 'screct_id') !== false && !isset($response['body']['data']), 'preflight ' . $path);
}
foreach (['/api/wechat/serve', '/api/wechat/miniServe', '/api/pay/notify/wechat', '/api/transfer/notify/wechat', '/api/order_call_back', '/api/sms/pay/notify'] as $path) {
    foreach ([[], tenantHeaders($fixture[1])] as $headers) assertHeader(httpHeader($path, $headers, 'POST')['http'] === 503, 'callback closed ' . $path);
}
$connection = new class extends Workerman\Connection\TcpConnection {
    public $sent = [];
    public function __construct() {}
    public function __destruct() {}
    public function close($data = null, $raw = false) { $this->sent[] = ['close', $data]; return true; }
    public function send($data, $raw = false) { $this->sent[] = ['send', $data]; return true; }
};
$anonymous = clone $connection;
$chat = new crmeb\services\workerman\chat\ChatService(new Workerman\Worker());
ob_start();
$chat->onConnect($anonymous);
$chat->onMessage($anonymous, json_encode(['type' => 'to_chat', 'data' => ['tourist_uid' => 998877,
    'appid' => $fixture[1]['client_id'], 'screct_id' => $fixture[1]['app_secret']]]));
$console = ob_get_clean();
assertHeader(count($anonymous->sent) === 1 && $anonymous->sent[0][0] === 'close', 'headerless consumer WS cannot authenticate through message parameters');
assertHeader(strpos($console, $fixture[1]['app_secret']) === false, 'WS messages no longer dump secrets');
$staffParser = new class extends app\services\kefu\LoginServices {
    public $reached = false;
    public function __construct() {}
    public function parseToken(string $token) { $this->reached = true; throw new RuntimeException('staff parser reached'); }
};
$app->instance(app\services\kefu\LoginServices::class, $staffParser);
$staffAttempt = clone $connection;
$staffAttempt->tenantClientRequired = true;
$chat->onMessage($staffAttempt, json_encode(['type' => 'kefu_login', 'data' => $fixture[1]['user_token']]));
assertHeader(!$staffParser->reached, 'consumer JWT rejected before headerless staff lookup');
$app->instance(app\services\kefu\LoginServices::class, new app\services\kefu\LoginServices(new app\dao\service\StoreServiceDao()));
foreach ([1, 2] as $id) {
    TenantContext::set($id);
    $staffId = Db::name('store_service')->insertGetId(['tenant_id' => $id, 'uid' => $fixture[$id]['uid'],
        'account' => 'header-staff-' . $id, 'nickname' => 'Header staff', 'status' => 1]);
    $staffToken = app()->make(crmeb\utils\JwtAuth::class)->createToken($staffId, 'kefu', ['tenant_id' => $id])['token'];
    $staffConnection = clone $connection;
    $staffConnection->tenantClientRequired = true;
    $chat->onMessage($staffConnection, json_encode(['type' => 'kefu_login', 'data' => $staffToken]));
    assertHeader(isset($staffConnection->kefuUser) && $staffConnection->tenantId === $id && !$staffConnection->tenantClientRequired &&
        $staffConnection->sent[0][0] === 'send', 'verified staff exception tenant ' . $id);
}
crmeb\services\workerman\chat\TenantHandshake::authenticate($connection, "GET / HTTP/1.1\r\nApPiD: " . $fixture[1]['client_id'] . "\r\nScReCt_Id: " . $fixture[1]['app_secret'] . "\r\n\r\n");
assertHeader(crmeb\services\workerman\chat\TenantHandshake::tenantId($connection) === 1, 'WS handshake binds tenant using wire headers');
assertHeader(strpos(json_encode($connection->clientTenantIdentity), $fixture[1]['app_secret']) === false, 'WS connection retains no plaintext secret');
$connection->tenantClientRequired = true;
TenantContext::bindClient(1);
$wsResponse = (new crmeb\services\workerman\Response())->connection($connection);
$wsResponse->send('test', ['marker' => 1]);
assertHeader($connection->sent[0][0] === 'send', 'authorized WS delivery');
TenantContext::bindClient(2);
assertHeader($wsResponse->send('test', ['other_tenant' => 2]) === false && count($connection->sent) === 1, 'WS other tenant push withheld');
TenantContext::bindClient(1);
$reset = app()->make(TenantCredentialServices::class)->generate(['level' => 0], 1, true);
$wsResponse->send('test', ['must_not_send' => 1]);
assertHeader($connection->sent[1][0] === 'close' && strpos($connection->sent[1][1], 'must_not_send') === false, 'reset closes WS before business push');
noData(httpHeader('/api/products', tenantHeaders($fixture[1])), 'tenant_credentials_invalid', 'reset old credentials');
assertHeader((httpHeader('/api/version', tenantHeaders($reset))['body']['status'] ?? 0) === 200, 'reset new credentials');
Db::name('tenant')->where('id', 1)->update(['status' => 0]);
noData(httpHeader('/api/products', tenantHeaders($reset)), 'tenant_credentials_invalid', 'disabled tenant');
assertHeader((httpHeader('/api/version', tenantHeaders($fixture[2]))['body']['status'] ?? 0) === 200, 'other tenant unaffected');
Db::name('tenant')->where('id', 1)->delete();
noData(httpHeader('/api/version', tenantHeaders($reset)), 'tenant_credentials_invalid', 'deleted tenant');
Db::execute('RENAME TABLE eb_tenant_credential TO eb_tenant_credential_unavailable');
try {
    noData(httpHeader('/api/version', tenantHeaders($fixture[2])), 'tenant_auth_unavailable', 'credential store unavailable');
} finally {
    Db::execute('RENAME TABLE eb_tenant_credential_unavailable TO eb_tenant_credential');
}
echo "PASS formal Nginx/FPM header contract\n";
