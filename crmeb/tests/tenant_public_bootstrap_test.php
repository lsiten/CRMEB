<?php
require __DIR__ . '/tenant_bootstrap.php';

// The historical public bootstrap contract is intentionally retired by LSIT-30.
// Formal HTTP closure and header exchange are exercised by run_tenant_header_http.sh.
$service = new app\services\system\TenantBootstrapServices();
foreach ([[], ['entry' => 'store-a'], ['entry' => 'store-b'], ['client_id' => 'public']] as $input) {
    denied(function () use ($service, $input) { $service->bootstrap($input); }, 403, 'anonymous issuer remains closed');
}
denied(function () { (new app\services\system\TenantCredentialServices())->issuePublicToken(str_repeat('a', 32)); }, 403, 'direct public issuer remains closed');
echo "All public issuer closure checks passed.\n";
