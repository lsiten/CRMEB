<?php
return [
    \app\http\middleware\AllowOriginMiddleware::class,
    \app\api\middleware\TenantCallbackMiddleware::class,
    \app\api\middleware\TenantTokenMiddleware::class,
];
