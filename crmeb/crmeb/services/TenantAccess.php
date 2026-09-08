<?php
namespace crmeb\services;

use crmeb\exceptions\AuthException;

final class TenantAccess
{
    public static function platform(array $admin): bool
    {
        return isset($admin['level']) && (int)$admin['level'] === 0;
    }

    public static function requirePlatform(array $admin): void
    {
        if (!self::platform($admin)) throw new AuthException('无权操作租户', [], 403);
    }

    public static function requireTenant(array $admin, int $tenantId): void
    {
        if ($tenantId <= 0 || (!self::platform($admin) && $tenantId !== (int)($admin['tenant_id'] ?? 0))) {
            throw new AuthException('无权操作租户', [], 403);
        }
    }

    public static function menus(array $menus, int $level): array
    {
        if ($level === 0) return $menus;
        $excluded = [];
        do {
            $count = count($excluded);
            foreach ($menus as $menu) {
                if (preg_match('~/system/tenant(?:/|$)~', $menu['menu_path'] ?? '') || isset($excluded[$menu['pid'] ?? 0])) {
                    $excluded[$menu['id']] = true;
                }
            }
        } while (count($excluded) !== $count);
        return array_values(array_filter($menus, static function (array $menu) use ($excluded) {
            return !isset($excluded[$menu['id']]);
        }));
    }
}
