<?php
use think\facade\Db;

function seedAdminLogin(): string
{
    $sql = file_get_contents(dirname(__DIR__) . '/public/install/crmeb.sql');
    foreach (['system_admin', 'system_role', 'system_menus', 'system_config', 'system_log'] as $table) {
        if (!preg_match('/CREATE TABLE IF NOT EXISTS `eb_' . $table . '` \(.*?;\s/s', $sql, $match)) {
            throw new RuntimeException('Missing installation DDL: ' . $table);
        }
        Db::execute($match[0]);
        if (strpos($match[0], '`tenant_id`') === false) {
            Db::execute('ALTER TABLE `eb_' . $table . '` ADD tenant_id INT UNSIGNED NOT NULL DEFAULT 1');
        }
    }
    Db::execute('CREATE TABLE eb_tenant (id INT UNSIGNED PRIMARY KEY, name VARCHAR(100), code VARCHAR(64), status INT)');
    Db::name('system_menus')->insert(['tenant_id' => 2, 'menu_name' => 'Current administrator',
        'auth_type' => 2, 'api_url' => 'setting/info', 'methods' => 'GET']);
    Db::execute(file_get_contents(dirname(__DIR__) . '/upgrade/tenant_credentials.sql'));
    Db::name('tenant')->insertAll([
        ['id' => 1, 'name' => 'A', 'code' => 'a', 'status' => 1],
        ['id' => 2, 'name' => 'B', 'code' => 'b', 'status' => 1],
    ]);
    Db::execute('CREATE TABLE eb_tenant_test_item (id INT PRIMARY KEY, tenant_id INT, name VARCHAR(20))');
    Db::name('tenant_test_item')->insertAll([
        ['id' => 1, 'tenant_id' => 1, 'name' => 'A'], ['id' => 2, 'tenant_id' => 2, 'name' => 'B'],
    ]);
    $password = bin2hex(random_bytes(12));
    foreach ([['alpha', 1, 1], ['bravo', 2, 1], ['platform', 1, 0]] as $i => $admin) {
        Db::name('system_admin')->insert(['id' => $i + 10, 'account' => $admin[0],
            'tenant_id' => $admin[1], 'level' => $admin[2], 'pwd' => password_hash($password, PASSWORD_BCRYPT)]);
    }
    return $password;
}

function startAdminHttp(&$server): string
{
    $socket = stream_socket_server('tcp://127.0.0.1:0', $errno, $error);
    if (!$socket) throw new RuntimeException($error);
    $address = stream_socket_get_name($socket, false);
    fclose($socket);
    $log = getenv('TENANT_TEST_CACHE') . '/admin-http.log';
    $server = proc_open([PHP_BINARY, '-S', $address, __DIR__ . '/admin_login_router.php'],
        [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']], $pipes);
    if (!is_resource($server)) throw new RuntimeException('HTTP server failed to start');
    fclose($pipes[0]);
    for ($attempt = 0; $attempt < 100; $attempt++) {
        if (!proc_get_status($server)['running']) throw new RuntimeException('HTTP server exited');
        $connection = @stream_socket_client('tcp://' . $address, $errno, $error, 0.1);
        if ($connection) { fclose($connection); return 'http://' . $address . '/adminapi/'; }
        usleep(20000);
    }
    throw new RuntimeException('HTTP server not ready');
}

function adminHttp(string $base, string $path, ?array $body = null, string $token = ''): array
{
    $curl = curl_init($base . $path);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $token]]);
    if ($body !== null) curl_setopt_array($curl, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode($body)]);
    $raw = curl_exec($curl);
    if ($raw === false) throw new RuntimeException(curl_error($curl));
    $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
    curl_close($curl);
    $data = json_decode($raw, true);
    if ($status !== 200 || !is_array($data)) {
        $log = file_get_contents(getenv('TENANT_TEST_CACHE') . '/admin-http.log');
        $plain = strip_tags(preg_replace('#<(style|script)\b[^>]*>.*?</\1>#s', '', $raw));
        throw new RuntimeException('HTTP ' . $status . ': ' . substr(trim($plain), 0, 3000) . substr($log, -1000));
    }
    echo 'HTTP 200 ' . $path . ' status=' . $data['status'] . PHP_EOL;
    return $data;
}
