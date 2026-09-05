<?php
namespace crmeb\basic;

use crmeb\services\TenantContext;
use think\db\Query;

/** Base model for tenant-owned tables. */
abstract class TenantScope extends BaseModel
{
    protected static function init()
    {
        parent::init();
    }

    /**
     * Populate the tenant on every model write.
     *
     * ThinkORM 2.0.33 does not provide the static event-registration helpers
     * (such as onBeforeInsert($callback)); its event dispatcher invokes
     * concrete onBefore* methods on the model instead.
     */
    public static function onBeforeWrite($model): void
    {
        $data = $model->getData();
        if (TenantContext::id() !== null) {
            $model->setAttr('tenant_id', TenantContext::id());
        }
    }

    protected function setTenantIdAttr($value): int
    {
        return (int)($value ?: (TenantContext::id() ?? 0));
    }

    public static function applyTenantScope($model)
    {
        $tenantId = TenantContext::id();
        if ($tenantId !== null && !TenantContext::isCrossTenant()) {
            $prefix = (string)config('database.connections.' . config('database.default') . '.prefix');
            $model->where($prefix . $model->getName() . '.tenant_id', $tenantId);
        }
        return $model;
    }

    public function scopeTenant(Query $query, $tenantId = null): Query
    {
        $prefix = (string)config('database.connections.' . config('database.default') . '.prefix');
        return $query->where($prefix . $this->getName() . '.tenant_id', $tenantId ?? TenantContext::id());
    }
}
