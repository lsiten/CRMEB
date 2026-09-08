<?php
require __DIR__ . '/tenant_bootstrap.php';
try {
    (new \app\services\system\TenantCredentialServices())->generate(['level' => 1, 'tenant_id' => 3], 3);
    echo 'CREATED';
} catch (\crmeb\exceptions\AuthException $e) {
    if ($e->getCode() !== 409) throw $e;
    echo 'CONFLICT';
}
