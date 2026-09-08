<?php
namespace app\api\controller\v1;

use app\services\system\TenantCredentialServices;
use crmeb\basic\BaseController;
use crmeb\exceptions\AuthException;

class TenantController extends BaseController
{
    protected function initialize() {}

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
