<?php
namespace app\api\controller\v1;

use app\services\system\TenantCredentialServices;
use app\services\system\TenantBootstrapServices;
use crmeb\basic\BaseController;
use crmeb\exceptions\AuthException;

class TenantController extends BaseController
{
    protected function initialize() {}

    public function bootstrap()
    {
        try {
            $data = app()->make(TenantBootstrapServices::class)->bootstrap($this->request->post());
            return app('json')->success($data)->header(['Cache-Control' => 'no-store']);
        } catch (AuthException $e) {
            $code = $e->getCode() === 400 ? 'tenant_bootstrap_invalid_request' : 'tenant_bootstrap_unavailable';
            return app('json')->make($e->getCode(), $e->getMessage(), ['code' => $code])
                ->header(['Cache-Control' => 'no-store']);
        }
    }

    public function token()
    {
        try {
            $data = app()->make(TenantCredentialServices::class)->exchange($this->request->post());
            return app('json')->success($data)->header(['Cache-Control' => 'no-store']);
        } catch (AuthException $e) {
            return app('json')->make($e->getCode(), $e->getMessage())->header(['Cache-Control' => 'no-store']);
        }
    }
}
