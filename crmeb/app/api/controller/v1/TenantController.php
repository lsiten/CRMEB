<?php
namespace app\api\controller\v1;

use app\services\system\TenantCredentialServices;
use crmeb\basic\BaseController;
use crmeb\exceptions\AuthException;

class TenantController extends BaseController
{
    protected function initialize() {}

    public function bootstrap()
    {
        return \app\api\middleware\TenantTokenMiddleware::error(403, 'tenant_bootstrap_unavailable', '租户公开引导已关闭');
    }

    public function token()
    {
        try {
            $data = app()->make(TenantCredentialServices::class)->exchange([
                'client_id' => $this->request->header('appid'),
                'app_secret' => \app\api\middleware\TenantTokenMiddleware::secret($this->request),
            ]);
            return app('json')->success($data)->header(['Cache-Control' => 'no-store']);
        } catch (AuthException $e) {
            return \app\api\middleware\TenantTokenMiddleware::error(401, 'tenant_credentials_invalid', '租户凭据无效');
        } catch (\Throwable $e) {
            return \app\api\middleware\TenantTokenMiddleware::error(503, 'tenant_auth_unavailable', '租户认证暂不可用');
        }
    }
}
