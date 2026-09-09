<?php
namespace app\services\system;

use crmeb\exceptions\AuthException;

class TenantBootstrapServices
{
    public function bootstrap(array $input): array
    {
        $entry = $input['entry'] ?? null;
        if (count($input) !== 1 || !is_string($entry) || !preg_match('/^[a-zA-Z0-9_-]{1,64}$/D', $entry)) {
            throw new AuthException('引导参数错误', [], 400);
        }
        $entries = config('tenant_bootstrap.entries', []);
        if (!is_array($entries) || !array_key_exists($entry, $entries)) {
            throw new AuthException('租户入口未开放', [], 403);
        }
        $clientId = $entries[$entry];
        if (!is_string($clientId) || !preg_match('/^[a-f0-9]{32}$/D', $clientId)) {
            throw new AuthException('租户入口暂不可用', [], 503);
        }
        try {
            return app()->make(TenantCredentialServices::class)->issuePublicToken($clientId);
        } catch (AuthException $e) {
            throw new AuthException('租户入口暂不可用', [], 503);
        }
    }
}
