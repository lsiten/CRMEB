<?php
namespace app\model\system;

use crmeb\basic\BaseModel;
use crmeb\traits\ModelTrait;

/** 租户主表。 */
class Tenant extends BaseModel
{
    use ModelTrait;
    protected $pk = 'id';
    protected $name = 'tenant';
    protected $insert = ['add_time'];
}
