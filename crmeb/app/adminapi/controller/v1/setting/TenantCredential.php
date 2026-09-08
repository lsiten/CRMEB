<?php
namespace app\adminapi\controller\v1\setting;

use app\services\system\TenantCredentialServices;
use crmeb\basic\BaseController;
use crmeb\exceptions\AuthException;

class TenantCredential extends BaseController
{
    protected function initialize() {}

    public function read($id) { return $this->respond((int)$id, 'info'); }
    public function generate($id) { return $this->respond((int)$id, 'generate'); }
    public function reset($id) { return $this->respond((int)$id, 'generate', true); }

    private function respond(int $id, string $method, bool $reset = false)
    {
        try {
            $service = app()->make(TenantCredentialServices::class);
            $data = $service->$method($this->request->adminInfo(), $id, $reset);
            return app('json')->success($data)->header(['Cache-Control' => 'no-store']);
        } catch (AuthException $e) {
            return app('json')->make($e->getCode(), $e->getMessage())->header(['Cache-Control' => 'no-store']);
        }
    }
}
