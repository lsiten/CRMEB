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
        static::onBeforeInsert(function ($model) {
            if (!$model->getData('tenant_id') && TenantContext::id() !== null) {
                $model->setAttr('tenant_id', TenantContext::id());
            }
        });
    }

    protected function setTenantIdAttr($value): int
    {
        return (int)($value ?: (TenantContext::id() ?? 0));
    }

    public static function applyTenantScope($model)
    {
        $tenantId = TenantContext::id();
        if ($tenantId !== null && !TenantContext::isCrossTenant()) {
            $model->where($model->getName() . '.tenant_id', $tenantId);
        }
        return $model;
    }

    public function scopeTenant(Query $query, $tenantId = null): Query
    {
        return $query->where($this->getName() . '.tenant_id', $tenantId ?? TenantContext::id());
    }
}
