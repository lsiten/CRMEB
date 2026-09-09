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

namespace app\services\kefu;


use crmeb\exceptions\AuthException;
use crmeb\services\oauth\OAuth;
use app\services\BaseServices;
use crmeb\services\CacheService;
use app\dao\service\StoreServiceDao;
use app\services\wechat\WechatUserServices;
use app\model\system\Tenant;
use app\model\service\StoreService;
use crmeb\services\TenantContext;
use Firebase\JWT\JWT;
use think\facade\Env;

/**
 * 客服登录
 * Class LoginServices
 * @package app\services\kefu
 * @method get($id, ?array $field = [], ?array $with = []) 获取一条数据
 */
class LoginServices extends BaseServices
{
    /**
     * LoginServices constructor.
     * @param StoreServiceDao $dao
     */
    public function __construct(StoreServiceDao $dao)
    {
        $this->dao = $dao;
    }

    /**
     * 客服账号密码登录
     * @param string $account
     * @param string $password
     * @return array
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public function authLogin(string $account, string $password = null, string $tenantCode = '')
    {
        $tenantCode = trim($tenantCode);
        if (mb_strlen($tenantCode) > 64) throw new AuthException('租户编码格式错误');
        $tenantId = null;
        if ($tenantCode !== '') {
            $tenants = Tenant::where('code', $tenantCode)->limit(2)->select();
            if ($tenants->count() !== 1 || (int)$tenants[0]->status !== 1) {
                throw new AuthException('账号或密码错误');
            }
            $tenantId = (int)$tenants[0]->id;
        }
        $candidates = $this->dao->loginCandidates($account, $tenantId);
        if ($candidates->count() !== 1 || $password === null || !password_verify($password, $candidates[0]->password)) {
            throw new AuthException('账号或密码错误');
        }
        return $this->loginKnownService($candidates[0]);
    }

    public function loginById(int $id): array
    {
        $kefuInfo = $this->dao->get($id);
        if (!$kefuInfo) throw new AuthException('账号或密码错误');
        return $this->loginKnownService($kefuInfo);
    }

    private function loginKnownService(StoreService $kefuInfo): array
    {
        $tenantId = (int)$kefuInfo->tenant_id;
        if ((int)$kefuInfo->status !== 1 || $tenantId <= 0 || !Tenant::where(['id' => $tenantId, 'status' => 1])->count()) {
            throw new AuthException('账号或密码错误');
        }
        $previousTenant = TenantContext::id();
        $previousCrossTenant = TenantContext::isCrossTenant();
        try {
            TenantContext::set($tenantId);
            $token = $this->createToken($kefuInfo->id, 'kefu');
            $kefuInfo->update_time = time();
            $kefuInfo->ip = request()->ip();
            $kefuInfo->online = 1;
            $kefuInfo->save();
            return [
                'token' => $token['token'],
                'exp_time' => $token['params']['exp'],
                'kefuInfo' => $kefuInfo->hidden(['password', 'ip', 'update_time', 'add_time', 'status', 'mer_id', 'customer', 'notify'])->toArray()
            ];
        } finally {
            TenantContext::set($previousTenant, $previousCrossTenant);
        }
    }

    /**
     * 解析token
     * @param string $token
     * @return array
     * @throws \Psr\SimpleCache\InvalidArgumentException
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public function parseToken(string $token)
    {
        $previousTenant = TenantContext::id();
        $previousCrossTenant = TenantContext::isCrossTenant();
        $previousLeeway = JWT::$leeway;
        try {
            if ($token === '' || $token === 'undefined') throw new \UnexpectedValueException('Missing token');
            JWT::$leeway = 60;
            $claims = JWT::decode($token, Env::get('app.app_key', 'default'), ['HS256']);
            $id = $claims->jti->id ?? null;
            $type = $claims->jti->type ?? null;
            $tenantId = property_exists($claims, 'tenant_id') ? $claims->tenant_id : TenantContext::DEFAULT_TENANT_ID;
            if ($type !== 'kefu' || !is_int($id) || $id <= 0 || !is_int($tenantId) || $tenantId <= 0 ||
                !isset($claims->exp) || !is_int($claims->exp)) {
                throw new \UnexpectedValueException('Invalid service claims');
            }
            $cached = CacheService::get(md5($token));
            if (!is_array($cached) || ($cached['uid'] ?? null) !== $id || ($cached['type'] ?? null) !== 'kefu' ||
                ($cached['token'] ?? null) !== $token) {
                throw new \UnexpectedValueException('Invalid service session');
            }
            TenantContext::set($tenantId);
            $kefuInfo = $this->dao->get($id);
            if (!$kefuInfo || (int)$kefuInfo->tenant_id !== $tenantId || (int)$kefuInfo->status !== 1 ||
                !Tenant::where(['id' => $tenantId, 'status' => 1])->count()) {
                throw new \UnexpectedValueException('Invalid service ownership');
            }
            $kefuInfo->type = 'kefu';
            return $kefuInfo->hidden(['password', 'ip', 'status']);
        } catch (\Throwable $e) {
            throw new AuthException('登录已过期,请重新登录', [], 402);
        } finally {
            JWT::$leeway = $previousLeeway;
            TenantContext::set($previousTenant, $previousCrossTenant);
        }
    }

    /**
     * @return array
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public function wechatAuth()
    {
        /** @var OAuth $oauth */
        $oauth = app()->make(OAuth::class);
        $original = $oauth->oauth(null, ['open' => true]);
        if (!isset($original['unionid'])) {
            throw new AuthException('unionid不存在');
        }
        /** @var WechatUserServices $userService */
        $userService = app()->make(WechatUserServices::class);
        $uid = $userService->value(['unionid' => $original['unionid']], 'uid');
        if (!$uid) {
            throw new AuthException('获取用户UID失败');
        }
        $kefuInfo = $this->dao->get(['uid' => $uid]);
        if (!$kefuInfo) {
            throw new AuthException('客服不存在');
        }
        if (!$kefuInfo->status) {
            throw new AuthException('您已被禁止登录，请联系管理员');
        }
        $token = $this->createToken($kefuInfo->id, 'kefu');
        $kefuInfo->update_time = time();
        $kefuInfo->ip = request()->ip();
        $kefuInfo->save();
        return [
            'token' => $token['token'],
            'exp_time' => $token['params']['exp'],
            'kefuInfo' => $kefuInfo->hidden(['password', 'ip', 'update_time', 'add_time', 'status', 'mer_id', 'customer', 'notify'])->toArray()
        ];
    }

    /**
     * 检测有没有人扫描登录
     * @param string $key
     * @return array|int[]
     * @throws \Psr\SimpleCache\InvalidArgumentException
     * @throws \think\db\exception\DataNotFoundException
     * @throws \think\db\exception\DbException
     * @throws \think\db\exception\ModelNotFoundException
     */
    public function scanLogin(string $key)
    {
        $hasKey = CacheService::has($key);
        if ($hasKey === false) {
            $status = 0;//不存在需要刷新二维码
        } else {
            $keyValue = CacheService::get($key);
            if ($keyValue === '0') {
                $status = 1;//正在扫描中
                $kefuInfo = $this->dao->get(['uniqid' => $key]);
                if ($kefuInfo) {
                    $tokenInfo = $this->loginKnownService($kefuInfo);
                    $tokenInfo['status'] = 3;
                    $kefuInfo->uniqid = '';
                    $kefuInfo->save();
                    CacheService::delete($key);
                    return $tokenInfo;
                }
            } else {
                $status = 2;//没有扫描
            }
        }
        return ['status' => $status];
    }
}
