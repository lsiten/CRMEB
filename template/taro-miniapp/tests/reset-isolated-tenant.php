<?php
// Only the freshly-created LSIT-21 test instance is accepted.
$port = (int)getenv('TENANT_TEST_PORT');
if ($port <= 1024 || $port === 3306) throw new RuntimeException('Dedicated test port required');
$pdo = new PDO('mysql:host=127.0.0.1;port=' . $port, 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$databases = $pdo->query("SHOW DATABASES LIKE 'lsit21_test_%'")->fetchAll(PDO::FETCH_COLUMN);
if (count($databases) !== 1 || !preg_match('/^lsit21_test_[a-f0-9]+$/D', $databases[0])) throw new RuntimeException('Exactly one isolated test database required');
putenv('TENANT_TEST_DATABASE=' . $databases[0]);
require dirname(__DIR__, 3) . '/crmeb/tests/tenant_bootstrap.php';
$service = new \app\services\system\TenantCredentialServices();
$service->generate(['level' => 0], 1, true);
echo "Isolated tenant A reset completed; no credentials emitted.\n";
