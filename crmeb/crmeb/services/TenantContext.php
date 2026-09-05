<?php
namespace crmeb\services;

/** Request-local tenant context used by admin authentication and model scopes. */
final class TenantContext
{
    private static ?int $tenantId = null;
    private static bool $crossTenant = false;

    public static function set(?int $tenantId, bool $crossTenant = false): void
    {
        self::$tenantId = $tenantId;
        self::$crossTenant = $crossTenant;
    }

    public static function id(): ?int { return self::$tenantId; }
    public static function isCrossTenant(): bool { return self::$crossTenant; }
    public static function clear(): void { self::set(null, false); }
}
