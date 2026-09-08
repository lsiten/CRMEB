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

namespace app\adminapi\middleware;


use app\Request;
use app\services\system\admin\AdminAuthServices;
use crmeb\interfaces\MiddlewareInterface;
use think\facade\Config;
use crmeb\services\CacheService;
use crmeb\services\TenantContext;

/**
 * 后台登陆验证中间件
 * Class AdminAuthTokenMiddleware
 * @package app\adminapi\middleware
 */
class AdminAuthTokenMiddleware implements MiddlewareInterface
{
    /**
     * @param Request $request
     * @param \Closure $next
     * @return mixed
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     * @author 吴汐
     * @email 442384644@qq.com
     * @date 2023/04/07
     */
    public function handle(Request $request, \Closure $next)
    {
        TenantContext::clear();
        $header = $request->header(Config::get('cookie.token_name', 'Authori-zation')) ?: $request->header('Authorization', '');
        $token = trim(preg_replace('/^Bearer\s+/i', '', $header));
        if (!$token) {
            $token = trim(ltrim($request->get('token')));
        }
        /** @var AdminAuthServices $service */
        $service = app()->make(AdminAuthServices::class);
        $adminInfo = $service->parseToken($token);
        $tenantId = (int)($adminInfo['tenant_id'] ?? 0);
        if ($tenantId <= 0 && !\crmeb\services\TenantAccess::platform($adminInfo)) {
            throw new \crmeb\exceptions\AuthException('管理员未绑定租户', [], 403);
        }
        TenantContext::set($tenantId, false);
        $request->macro('isAdminLogin', function () use (&$adminInfo) {
            return !is_null($adminInfo);
        });
        $request->macro('adminId', function () use (&$adminInfo) {
            return $adminInfo['id'];
        });

        $request->macro('adminInfo', function () use (&$adminInfo) {
            return $adminInfo;
        });
        $request->macro('tenantId', fn () => TenantContext::id());
        $request->macro('isCrossTenant', fn () => TenantContext::isCrossTenant());

        return $next($request);
    }
}
