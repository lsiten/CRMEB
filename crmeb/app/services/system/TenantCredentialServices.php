<?php
namespace app\services\system;

use crmeb\exceptions\AuthException;
use crmeb\exceptions\TenantAuthException;
use crmeb\services\TenantAccess;
use think\facade\Db;

class TenantCredentialServices
{
    public const TTL = 3600;

    public function info(array $admin, int $tenantId): array
    {
        TenantAccess::requireTenant($admin, $tenantId);
        $this->tenant($tenantId);
        $row = Db::name('tenant_credential')->where('tenant_id', $tenantId)->find();
        return ['tenant_id' => $tenantId, 'generated' => (bool)$row,
            'client_id' => $row['client_id'] ?? '', 'app_id' => $row['client_id'] ?? ''];
    }

    public function generate(array $admin, int $tenantId, bool $reset = false): array
    {
        TenantAccess::requireTenant($admin, $tenantId);
        return Db::transaction(function () use ($tenantId, $reset) {
            // The parent exists before the first credential; locking it serializes first creation too.
            $tenant = Db::name('tenant')->where('id', $tenantId)->lock(true)->find();
            if (!$tenant) throw new AuthException('租户不存在', [], 404);
            $row = Db::name('tenant_credential')->where('tenant_id', $tenantId)->lock(true)->find();
            if ($row && !$reset) throw new AuthException('凭据已生成，请使用重置接口', [], 409);
            if (!$row && $reset) throw new AuthException('请先生成凭据', [], 400);
            $secret = bin2hex(random_bytes(32));
            $data = ['client_id' => $row['client_id'] ?? bin2hex(random_bytes(16)),
                'secret_hash' => hash('sha256', $secret), 'updated_at' => time()];
            if ($row) {
                Db::name('tenant_credential')->where('tenant_id', $tenantId)->update($data);
            } else {
                Db::name('tenant_credential')->insert($data + ['tenant_id' => $tenantId]);
            }
            return ['tenant_id' => $tenantId, 'client_id' => $data['client_id'],
                'app_id' => $data['client_id'], 'app_secret' => $secret];
        });
    }

    public function exchange(array $input): array
    {
        $clientId = $input['client_id'] ?? $input['app_id'] ?? '';
        $secret = $input['app_secret'] ?? '';
        if (!is_string($clientId) || !is_string($secret) ||
            (isset($input['client_id'], $input['app_id']) && $input['client_id'] !== $input['app_id'])) {
            throw new AuthException('凭据参数错误', [], 400);
        }
        $row = $this->authenticate($clientId, $secret);
        return $this->issue($row);
    }

    public function authenticate(string $clientId, string $secret): array
    {
        if (!preg_match('/^[a-f0-9]{32}$/D', $clientId) || !preg_match('/^[a-f0-9]{64}$/D', $secret)) {
            throw new TenantAuthException(401, '租户凭据无效');
        }
        $row = $this->credential($clientId);
        if (!hash_equals($row['secret_hash'], hash('sha256', $secret))) {
            throw new TenantAuthException(401, '租户凭据无效');
        }
        $this->tenant((int)$row['tenant_id'], true);
        return $row;
    }

    // Existing callers must not recreate an anonymous issuer outside the HTTP gate.
    public function issuePublicToken(string $clientId): array
    {
        throw new TenantAuthException(403, '租户公开引导已关闭');
    }

    public function checkConnection(array $identity): int
    {
        $row = $this->credential($identity['client_id'] ?? '');
        if (!hash_equals(hash('sha256', $row['secret_hash']), $identity['revision'] ?? '') ||
            (int)$row['tenant_id'] !== ($identity['tenant_id'] ?? 0)) {
            throw new TenantAuthException(401, '租户凭据无效');
        }
        $this->tenant((int)$row['tenant_id'], true);
        return (int)$row['tenant_id'];
    }

    private function issue(array $row): array
    {
        $tenant = $this->tenant((int)$row['tenant_id'], true);
        $payload = $row['client_id'] . '.' . (time() + self::TTL) . '.' . bin2hex(random_bytes(16));
        return ['tenant' => $tenant, 'tenant_token' => $payload . '.' . hash_hmac('sha256', $payload, $row['secret_hash']),
            'expires_in' => self::TTL];
    }

    public function resolve(string $token): int
    {
        if (!preg_match('/^([a-f0-9]{32})\.([0-9]{10})\.([a-f0-9]{32})\.([a-f0-9]{64})$/D', $token, $parts)) {
            throw new TenantAuthException(401, '租户令牌无效');
        }
        $row = $this->credential($parts[1]);
        $payload = $parts[1] . '.' . $parts[2] . '.' . $parts[3];
        if ((int)$parts[2] <= time() || (int)$parts[2] > time() + self::TTL ||
            !hash_equals(hash_hmac('sha256', $payload, $row['secret_hash']), $parts[4])) {
            throw new TenantAuthException(401, '租户令牌无效');
        }
        $this->tenant((int)$row['tenant_id'], true);
        return (int)$row['tenant_id'];
    }

    private function credential(string $clientId): array
    {
        if (!preg_match('/^[a-f0-9]{32}$/D', $clientId)) throw new TenantAuthException(401, '租户凭据无效');
        $row = Db::name('tenant_credential')->where('client_id', $clientId)->find();
        if (!$row) throw new TenantAuthException(401, '租户凭据无效');
        return $row;
    }

    private function tenant(int $tenantId, bool $active = false): array
    {
        $tenant = Db::name('tenant')->where('id', $tenantId)->field('id,name,code,status')->find();
        if (!$tenant || ($active && !(int)$tenant['status'])) {
            if ($active) throw new TenantAuthException();
            throw new AuthException('租户不存在', [], 404);
        }
        unset($tenant['status']);
        return $tenant;
    }
}
