<?php
namespace crmeb\utils;

final class SensitiveData
{
    private static function sensitive(string $key): bool
    {
        $key = strtolower(str_replace(['-', '_'], '', $key));
        return (bool)preg_match('/secret|screct|token|authorization|password|passwd|^pwd$|^appid$|^clientid$|checkcode/', $key);
    }

    public static function redact($value)
    {
        if (is_array($value)) {
            foreach ($value as $key => $item) {
                $value[$key] = self::sensitive((string)$key) ? '[REDACTED]' : self::redact($item);
            }
            return $value;
        }
        if (is_object($value)) return '[object]';
        if (!is_string($value)) return $value;
        // Also protect secrets copied into an exception message or a different parameter name.
        $secrets = [];
        $collect = function (array $items) use (&$collect, &$secrets): void {
            foreach ($items as $key => $item) {
                if (self::sensitive((string)$key) && is_scalar($item) && (string)$item !== '') {
                    $secrets[] = (string)$item;
                } elseif (is_array($item)) {
                    $collect($item);
                }
            }
        };
        $collect(request()->header());
        $collect(request()->param());
        foreach ($secrets as $secret) {
            $value = str_replace([$secret, rawurlencode($secret), urlencode($secret)], '[REDACTED]', $value);
        }
        return preg_replace([
            '/\b[a-f0-9]{32,}\b/i',
            '/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/',
            '/Bearer\s+[^\s"\'<>]+/i',
        ], '[REDACTED]', $value);
    }
}
