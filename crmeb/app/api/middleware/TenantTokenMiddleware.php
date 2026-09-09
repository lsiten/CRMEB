<?php
namespace app\api\middleware;

use app\Request;
use app\services\system\TenantCredentialServices;
use crmeb\exceptions\AuthException;
use crmeb\services\TenantContext;
use think\Response;

class TenantTokenMiddleware
{
    public static function secret(Request $request)
    {
        $headers = array_change_key_case($request->header());
        // PHP-FPM maps underscores to hyphens; apache_request_headers preserves the wire spelling.
        if (isset($headers['screct_id'], $headers['screct-id'])) return [];
        return $headers['screct_id'] ?? $headers['screct-id'] ?? null;
    }

    public static function error(int $status, string $code, string $message): Response
    {
        // Json::make translates messages using tenant business data, including on rejection.
        return Response::create(['status' => $status, 'msg' => $message, 'data' => ['code' => $code]], 'json')
            ->header(['Cache-Control' => 'no-store']);
    }

    public function handle(Request $request, \Closure $next)
    {
        TenantContext::clear();
        try {
            if ($request->isOptions()) return Response::create('', 'html');
            $appid = $request->header('appid');
            $secret = self::secret($request);
            if ($appid === null || $secret === null || $appid === '' || $secret === '') {
                return self::error(401, 'tenant_auth_required', '请提供租户凭据');
            }
            if (!is_string($appid) || !is_string($secret)) {
                return self::error(401, 'tenant_credentials_invalid', '租户凭据无效');
            }
            try {
                $row = app()->make(TenantCredentialServices::class)->authenticate($appid, $secret);
            } catch (AuthException $e) {
                return self::error(401, 'tenant_credentials_invalid', '租户凭据无效');
            } catch (\Throwable $e) {
                return self::error(503, 'tenant_auth_unavailable', '租户认证暂不可用');
            }
            $id = (int)$row['tenant_id'];
            $target = $request->param('tenant_id');
            if ($target !== null && (!is_scalar($target) || (string)$target !== (string)$id)) {
                return self::error(403, 'tenant_mismatch', '租户不匹配');
            }
            TenantContext::bindClient($id);
            return $next($request);
        } catch (AuthException $e) {
            return self::error($e->getCode() ?: 401, $e->getCode() === 403 ? 'tenant_mismatch' : 'user_auth_invalid', $e->getMessage());
        } finally {
            TenantContext::clear();
        }
    }
}
