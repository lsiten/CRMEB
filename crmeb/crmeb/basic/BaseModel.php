<?php
// +----------------------------------------------------------------------
// | CRMEB [ CRMEB赋能开发者，助力企业发展 ]
// +----------------------------------------------------------------------
// | Copyright (c) 2016~2026 https://www.crmeb.com All rights reserved.
// +----------------------------------------------------------------------
// | Licensed CRMEB并不是自由软件，未经许可不能去掉CRMEB相关版权
// +----------------------------------------------------------------------
// | Author: CRMEB Team <admin@crmeb.com>
// +----------------------------------------------------------------------

namespace crmeb\basic;

use crmeb\services\TenantContext;
use crmeb\traits\ModelTrait;
use think\db\Query;
use think\Model;

/**
 * Class BaseModel
 * @package crmeb\basic
 * @mixin ModelTrait
 * @mixin Query
 */
class BaseModel extends Model
{
    protected $tenantScoped = true;

    protected $globalScope = ['tenant'];

    public static function onBeforeWrite($model): void
    {
        if ($model->tenantScoped && TenantContext::id() !== null) {
            $model->setAttr('tenant_id', TenantContext::id());
        }
    }

    public function scopeTenant(Query $query, $tenantId = null): Query
    {
        if (!$this->tenantScoped) return $query;
        return $query->where($this->getName() . '.tenant_id', $tenantId ?? TenantContext::id());
    }
}
