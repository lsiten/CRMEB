<?php
namespace app\services\system;

use crmeb\exceptions\TenantAuthException;

class TenantBootstrapServices
{
    public function bootstrap(array $input): array
    {
        throw new TenantAuthException(403, '租户公开引导已关闭');
    }
}
