<?php
namespace crmeb\services;

/** Request-local tenant context used by admin authentication and model scopes. */
final class TenantContext
{
    /** The installation always has a default tenant (seeded as id 1). */
    public const DEFAULT_TENANT_ID = 1;

    private static ?int $tenantId = self::DEFAULT_TENANT_ID;
    private static bool $crossTenant = false;

    public static function set(?int $tenantId, bool $crossTenant = false): void
    {
        // null/zero must never create unowned business records or unscoped reads.
        self::$tenantId = $tenantId !== null && $tenantId > 0
            ? $tenantId : self::DEFAULT_TENANT_ID;
        self::$crossTenant = $crossTenant;
    }

    public static function id(): ?int { return self::$tenantId; }
    public static function isCrossTenant(): bool { return self::$crossTenant; }
    public static function clear(): void { self::set(self::DEFAULT_TENANT_ID, false); }
    /** 为缓存、队列和导出资源生成租户隔离键。 */
    public static function key(string $name): string
    {
        return 'tenant:' . (self::$tenantId ?? 'global') . ':' . $name;
    }

    /** 返回可拼接到原生 SQL 的参数化租户条件。 */
    public static function sqlCondition(string $column = 'tenant_id'): array
    {
        if (self::$tenantId === null || self::$crossTenant) {
            return ['', []];
        }
        return [' AND `' . $column . '` = ?', [self::$tenantId]];
    }

    public static function sqlLiteral(string $column = 'tenant_id'): string
    {
        return self::$tenantId !== null && !self::$crossTenant
            ? ' AND `' . $column . '` = ' . (int)self::$tenantId : '';
    }
}
