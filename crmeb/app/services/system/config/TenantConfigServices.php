<?php

namespace app\services\system\config;

use think\facade\Db;

/**
 * Initializes tenant-owned system configuration from the default tenant.
 * Existing values are never overwritten.
 */
class TenantConfigServices
{
    public function syncTenant(int $tenantId, int $sourceTenantId = 1): int
    {
        if ($tenantId <= 0 || $tenantId === $sourceTenantId) return 0;

        $table = Db::name('system_config');
        $source = $table->where('tenant_id', $sourceTenantId)->select()->toArray();
        if (!$source) return 0;

        $existing = $table->where('tenant_id', $tenantId)
            ->field('menu_name,config_tab_id')
            ->select()
            ->toArray();
        $existingKeys = [];
        foreach ($existing as $row) {
            $existingKeys[$this->key($row)] = true;
        }

        $inserted = 0;
        foreach ($source as $row) {
            $key = $this->key($row);
            if (isset($existingKeys[$key])) continue;
            unset($row['id']);
            $row['tenant_id'] = $tenantId;
            $table->insert($row);
            $existingKeys[$key] = true;
            $inserted++;
        }
        return $inserted
            + $this->syncGroupData($tenantId, $sourceTenantId)
            + $this->syncTimers($tenantId, $sourceTenantId)
            + $this->syncSimple('system_notification', ['mark'], $tenantId, $sourceTenantId)
            + $this->syncSimple('system_user_level', ['name', 'grade'], $tenantId, $sourceTenantId)
            + $this->syncSimple('system_event_data', ['label', 'value'], $tenantId, $sourceTenantId)
            + $this->syncSimple('theme', ['title', 'version'], $tenantId, $sourceTenantId);
    }

    public function syncAll(int $sourceTenantId = 1): int
    {
        $tenantIds = Db::name('tenant')->where('id', '<>', $sourceTenantId)->column('id');
        $inserted = 0;
        foreach ($tenantIds as $tenantId) {
            $inserted += $this->syncTenant((int)$tenantId, $sourceTenantId);
        }
        return $inserted;
    }

    private function key(array $row): string
    {
        return (string)($row['menu_name'] ?? '') . ':' . (int)($row['config_tab_id'] ?? 0);
    }

    private function syncGroupData(int $tenantId, int $sourceTenantId): int
    {
        $table = Db::name('system_group_data');
        $source = $table->where('tenant_id', $sourceTenantId)->select()->toArray();
        $existing = $table->where('tenant_id', $tenantId)->field('gid,sort,status,value')->select()->toArray();
        $keys = [];
        foreach ($existing as $row) $keys[$this->groupKey($row)] = true;
        $count = 0;
        foreach ($source as $row) {
            $key = $this->groupKey($row);
            if (isset($keys[$key])) continue;
            unset($row['id']);
            $row['tenant_id'] = $tenantId;
            $table->insert($row);
            $keys[$key] = true;
            $count++;
        }
        return $count;
    }

    private function syncTimers(int $tenantId, int $sourceTenantId): int
    {
        $table = Db::name('system_timer');
        $source = $table->where('tenant_id', $sourceTenantId)->select()->toArray();
        $existing = $table->where('tenant_id', $tenantId)->column('mark');
        $marks = array_fill_keys($existing, true);
        $count = 0;
        foreach ($source as $row) {
            if (isset($marks[$row['mark']])) continue;
            unset($row['id']);
            $row['tenant_id'] = $tenantId;
            $table->insert($row);
            $marks[$row['mark']] = true;
            $count++;
        }
        return $count;
    }

    private function groupKey(array $row): string
    {
        return (int)($row['gid'] ?? 0) . ':' . (int)($row['sort'] ?? 0) . ':' . (int)($row['status'] ?? 0) . ':' . md5((string)($row['value'] ?? ''));
    }

    private function syncSimple(string $tableName, array $keyFields, int $tenantId, int $sourceTenantId): int
    {
        $table = Db::name($tableName);
        $source = $table->where('tenant_id', $sourceTenantId)->select()->toArray();
        if (!$source) return 0;
        $existing = $table->where('tenant_id', $tenantId)->select()->toArray();
        $keys = [];
        foreach ($existing as $row) $keys[$this->fieldsKey($row, $keyFields)] = true;
        $count = 0;
        foreach ($source as $row) {
            $key = $this->fieldsKey($row, $keyFields);
            if (isset($keys[$key])) continue;
            unset($row['id']);
            $row['tenant_id'] = $tenantId;
            $table->insert($row);
            $keys[$key] = true;
            $count++;
        }
        return $count;
    }

    private function fieldsKey(array $row, array $fields): string
    {
        return md5(json_encode(array_map(static function ($field) use ($row) {
            return $row[$field] ?? null;
        }, $fields), JSON_UNESCAPED_UNICODE));
    }
}
