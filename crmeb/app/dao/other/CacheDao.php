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

namespace app\dao\other;


use app\dao\BaseDao;
use app\model\other\Cache;
use crmeb\services\TenantContext;
use think\facade\Db;

/**
 * Class CacheDao
 * @package app\dao\other
 */
class CacheDao extends BaseDao
{
    public function saveOpenAdv(string $key, $result, int $expires)
    {
        $tenantId = TenantContext::id();
        return Db::transaction(function () use ($key, $result, $expires, $tenantId) {
            $table = Db::name('cache')->getTable();
            $written = Db::execute('INSERT INTO ' . $table
                . ' (`key`, `tenant_id`, `result`, `expire_time`, `add_time`) VALUES (?, ?, ?, ?, ?)'
                . ' ON DUPLICATE KEY UPDATE `result`=VALUES(`result`),'
                . ' `expire_time`=VALUES(`expire_time`), `add_time`=VALUES(`add_time`)',
                [$key, $tenantId, json_encode($result), $expires, time()]);
            if ((int)Db::name('cache')->where('key', $key)->value('tenant_id') !== $tenantId) {
                throw new \RuntimeException('Cache key belongs to another tenant');
            }
            Db::name('cache')->where('key', 'open_adv')->where('tenant_id', $tenantId)->delete();
            return $written;
        });
    }

    public function deleteOpenAdv(string $key)
    {
        return Db::name('cache')->where('tenant_id', TenantContext::id())
            ->whereIn('key', [$key, 'open_adv'])->delete();
    }

    /**
     * @return string
     */
    public function setModel(): string
    {
        return Cache::class;
    }

    /**
     * 清除过期缓存
     * @throws \Exception
     */
    public function delectDeOverdueDbCache()
    {
        $this->getModel()->where('expire_time', '<>', 0)->where('expire_time', '<', time())->delete();
    }
}
