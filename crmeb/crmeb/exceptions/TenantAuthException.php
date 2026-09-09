<?php
namespace crmeb\exceptions;

final class TenantAuthException extends AuthException
{
    public function __construct(int $code = 401, string $message = '租户凭据无效')
    {
        // Authentication precedes tenant language lookup. Bypass AuthException's getLang call.
        \RuntimeException::__construct($message, $code);
    }
}
