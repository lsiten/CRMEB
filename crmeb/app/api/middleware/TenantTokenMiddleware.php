<?php
namespace app\api\middleware;

use app\Request;
use app\services\system\TenantCredentialServices;
use crmeb\exceptions\AuthException;
use crmeb\services\TenantContext;

class TenantTokenMiddleware
{
    public function handle(Request $request, \Closure $next)
    {
        TenantContext::clear();
        try {
            $token = $request->header('X-Tenant-Token');
            if ($token !== null && !$request->isOptions()) {
                try {
                    $id = app()->make(TenantCredentialServices::class)->resolve((string)$token);
                } catch (AuthException $e) {
                    return app('json')->make(401, '租户令牌无效', ['code' => 'tenant_token_invalid'])
                        ->header(['Cache-Control' => 'no-store']);
                }
                TenantContext::bindClient($id);
            }
            return $next($request);
        } catch (AuthException $e) {
            return app('json')->make($e->getCode(), $e->getMessage());
        } finally {
            TenantContext::clear();
        }
    }
}
