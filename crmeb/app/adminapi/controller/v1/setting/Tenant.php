<?php

namespace app\adminapi\controller\v1\setting;

use app\model\system\Tenant as TenantModel;
use crmeb\basic\BaseController;
use crmeb\services\TenantContext;
use app\services\system\admin\AdminAuthServices;
use app\model\system\admin\SystemAdmin;

/** 后台租户查询与切换。 */
class Tenant extends BaseController
{
    protected function initialize()
    {
        // 租户列表在登录页也会被调用，不能依赖鉴权中间件。
    }

    /** 登录页可用租户列表，仅返回启用租户的公开字段。 */
    public function list()
    {
        $keyword = trim((string)$this->request->get('keyword', ''));
        $query = TenantModel::where('status', 1)->field(['id', 'name', 'code']);
        if ($keyword !== '') {
            $query->whereLike('name|code', '%' . $keyword . '%');
        }
        return app('json')->success(['list' => $query->order('id', 'asc')->select()->toArray()]);
    }

    /** 平台管理员切换当前租户上下文。 */
    public function switchTenant()
    {
        $admin = $this->request->adminInfo();
        $tenantId = (int)$this->request->post('tenant_id', 0);
        if ((int)($admin['level'] ?? 1) !== 0) {
            $tenantId = (int)($admin['tenant_id'] ?? 0);
        }
        $tenant = TenantModel::where(['id' => $tenantId, 'status' => 1])->find();
        if (!$tenant) {
            return app('json')->fail('租户不存在或已停用');
        }
        TenantContext::set($tenantId, false);
        $adminModel = SystemAdmin::where('id', (int)$admin['id'])->find();
        $result = ['tenant' => $tenant->visible(['id', 'name', 'code'])->toArray()];
        if ($adminModel) {
            $tokenInfo = app()->make(AdminAuthServices::class)->createToken(
                (int)$adminModel->id,
                (string)($admin['type'] ?? 'admin'),
                (string)$adminModel->pwd
            );
            $result['token'] = $tokenInfo['token'];
            $result['expires_time'] = $tokenInfo['params']['exp'];
        }
        return app('json')->success($result);
    }

    /** 后台租户管理页列表。 */
    public function adminList()
    {
        $admin = $this->request->adminInfo();
        $query = TenantModel::field(['id', 'name', 'code', 'status', 'add_time']);
        if ((int)($admin['level'] ?? 1) !== 0) {
            $query->where('id', (int)($admin['tenant_id'] ?? 0));
        }
        return app('json')->success(['list' => $query->order('id', 'asc')->select()->toArray()]);
    }
}
