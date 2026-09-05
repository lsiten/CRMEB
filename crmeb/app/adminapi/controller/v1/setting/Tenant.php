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

    /** 新增租户（仅平台管理员）。 */
    public function create()
    {
        if (!$this->isPlatformAdmin()) return app('json')->fail('无权操作租户');
        $data = $this->tenantData();
        if (!$data['name'] || !$data['code']) return app('json')->fail('租户名称和编码不能为空');
        if (TenantModel::where('code', $data['code'])->find()) return app('json')->fail('租户编码已存在');
        $tenant = TenantModel::create($data);
        return app('json')->success('租户创建成功', ['id' => $tenant->id]);
    }

    /** 修改租户（仅平台管理员）。 */
    public function update($id)
    {
        if (!$this->isPlatformAdmin()) return app('json')->fail('无权操作租户');
        $tenant = TenantModel::find((int)$id);
        if (!$tenant) return app('json')->fail('租户不存在');
        $data = $this->tenantData();
        if (!$data['name'] || !$data['code']) return app('json')->fail('租户名称和编码不能为空');
        if (TenantModel::where('code', $data['code'])->where('id', '<>', (int)$id)->find()) {
            return app('json')->fail('租户编码已存在');
        }
        $tenant->save($data);
        return app('json')->success('租户修改成功');
    }

    /** 删除租户（仅平台管理员）。 */
    public function delete($id)
    {
        if (!$this->isPlatformAdmin()) return app('json')->fail('无权操作租户');
        $id = (int)$id;
        if ($id === 1) return app('json')->fail('默认租户不能删除');
        $tenant = TenantModel::find($id);
        if (!$tenant) return app('json')->fail('租户不存在');
        if (SystemAdmin::where('tenant_id', $id)->count()) return app('json')->fail('租户存在管理员，不能删除');
        if (!$tenant->delete()) return app('json')->fail('删除失败');
        return app('json')->success('租户删除成功');
    }

    /** 修改租户启用状态（仅平台管理员）。 */
    public function setStatus($id, $status)
    {
        if (!$this->isPlatformAdmin()) return app('json')->fail('无权操作租户');
        $status = (int)$status;
        if (!in_array($status, [0, 1], true)) return app('json')->fail('状态参数错误');
        $tenant = TenantModel::find((int)$id);
        if (!$tenant) return app('json')->fail('租户不存在');
        if ($status === 0 && (int)TenantModel::where('status', 1)->count() <= 1) {
            return app('json')->fail('至少保留一个启用租户');
        }
        $tenant->save(['status' => $status]);
        return app('json')->success('状态修改成功');
    }

    private function isPlatformAdmin(): bool
    {
        return (int)($this->request->adminInfo()['level'] ?? 1) === 0;
    }

    private function tenantData(): array
    {
        $data = $this->request->postMore([
            ['name', ''],
            ['code', ''],
            ['status', 1],
        ]);
        $data['name'] = trim((string)$data['name']);
        $data['code'] = trim((string)$data['code']);
        $data['status'] = (int)$data['status'] === 1 ? 1 : 0;
        return $data;
    }
}
