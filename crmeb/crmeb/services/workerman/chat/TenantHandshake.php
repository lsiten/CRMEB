<?php
namespace crmeb\services\workerman\chat;

use app\services\system\TenantCredentialServices;
use crmeb\exceptions\TenantAuthException;
use Workerman\Connection\TcpConnection;

final class TenantHandshake
{
    public static function authenticate(TcpConnection $connection, string $buffer): void
    {
        $headers = [];
        foreach (explode("\r\n", explode("\r\n\r\n", $buffer, 2)[0]) as $line) {
            $parts = explode(':', $line, 2);
            $key = strtolower(trim($parts[0]));
            if (!in_array($key, ['appid', 'screct_id'], true)) continue;
            if (isset($headers[$key])) {
                $connection->close("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n", true);
                return;
            }
            $headers[$key] = trim($parts[1] ?? '');
        }
        // A headerless connection can only authenticate as a staff account, never as a consumer.
        if (!$headers) return;
        try {
            $row = app()->make(TenantCredentialServices::class)->authenticate($headers['appid'] ?? '', $headers['screct_id'] ?? '');
            $connection->clientTenantIdentity = [
                'client_id' => $row['client_id'], 'tenant_id' => (int)$row['tenant_id'],
                'revision' => hash('sha256', $row['secret_hash']),
            ];
            $connection->tenantId = (int)$row['tenant_id'];
        } catch (\Throwable $e) {
            $connection->close("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\nContent-Length: 0\r\n\r\n", true);
        }
    }

    public static function tenantId(TcpConnection $connection): int
    {
        if (!isset($connection->clientTenantIdentity)) throw new TenantAuthException(401, '请提供租户凭据');
        return app()->make(TenantCredentialServices::class)->checkConnection($connection->clientTenantIdentity);
    }
}
