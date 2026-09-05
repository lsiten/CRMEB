<?php

use app\http\middleware\AllowOriginMiddleware;
use think\facade\Route;

// 登录页租户选择接口（无需登录）。
Route::get('tenant/list', 'v1.setting.Tenant/list')->middleware(AllowOriginMiddleware::class)
    ->option(['mark' => 'login', 'real_name' => '租户列表']);

// 需要登录的租户上下文与管理接口。
Route::group('tenant', function () {
    Route::post('switch', 'v1.setting.Tenant/switchTenant')->option(['real_name' => '切换租户']);
})->middleware([
    AllowOriginMiddleware::class,
    \app\adminapi\middleware\AdminAuthTokenMiddleware::class,
    \app\adminapi\middleware\AdminCheckRoleMiddleware::class,
    \app\adminapi\middleware\AdminLogMiddleware::class,
]);
