<?php
namespace app\api\middleware;

use app\Request;
use think\Response;

class TenantCallbackMiddleware
{
    public function handle(Request $request, \Closure $next, bool $callback = false)
    {
        $path = strtolower(trim(rawurldecode($request->pathinfo()), '/'));
        $path = preg_replace('~^api/~', '', $path);
        $path = preg_replace('~\.[a-z0-9]+$~', '', $path);
        // These protocols have no verified account-to-tenant binding yet. Never acknowledge a payment as processed.
        if ($callback || preg_match('~^(wechat/(serve|miniserve)|pay/notify/[^/]+|transfer/notify/[^/]+|order_call_back|sms/pay/notify)$~D', $path)) {
            return Response::create('callback tenant binding unavailable', 'html', 503)
                ->header(['Cache-Control' => 'no-store']);
        }
        return $next($request);
    }
}
