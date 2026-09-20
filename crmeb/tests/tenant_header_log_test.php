<?php
require dirname(__DIR__) . '/vendor/autoload.php';
require dirname(__DIR__) . '/vendor/topthink/framework/src/helper.php';
function msectime() { return microtime(true) * 1000; }
$app = new think\App(dirname(__DIR__) . '/');
think\Container::setInstance($app);
$directory = sys_get_temp_dir() . '/lsit30-log-' . bin2hex(random_bytes(6));
mkdir($directory, 0700);
$secret = bin2hex(random_bytes(32));
$token = 'test-user-token-' . bin2hex(random_bytes(16));
$request = (new app\Request())->withHeader(['appid' => bin2hex(random_bytes(16)), 'screct_id' => $secret, 'authorization' => 'Bearer ' . $token])
    ->withGet(['nested' => ['app_secret' => $secret, 'token' => $token], 'copy' => $secret])->setMethod('GET')
    ->withServer(['REQUEST_TIME_FLOAT' => microtime(true), 'REMOTE_ADDR' => '127.0.0.1']);
$request->macro('uid', function () { return 0; });
$request->macro('adminId', function () { return 0; });
$request->macro('kefuId', function () { return 0; });
$app->instance('request', $request);
$app->config->set(['default' => 'file', 'level' => [], 'success_log' => true, 'fail_log' => true,
    'channels' => ['file' => ['type' => 'File', 'path' => $directory, 'single' => true, 'realtime_write' => true]]], 'log');
$app->event->listen('LogWrite', app\listener\http\RedactLogListener::class);
try {
    think\facade\Log::write('SDK/SQL error ' . $secret . ' ' . $token, 'error');
    $error = new RuntimeException('test exception ' . $secret . ' token ' . $token);
    (new app\api\ApiExceptionHandle($app))->report($error);
    (new app\kefuapi\KefuApiExceptionHandle($app))->report($error);
    (new app\ExceptionHandle($app))->report($error);
    $responseSecret = bin2hex(random_bytes(32));
    (new app\listener\http\HttpEndListener())->handle(json(['status' => 200, 'data' => ['app_secret' => $responseSecret, 'tenant_token' => $token]]));
    think\facade\Log::save();
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));
    $contents = '';
    foreach ($files as $file) if ($file->isFile()) $contents .= file_get_contents($file->getPathname());
    if ($contents === '' || strpos($contents, '[REDACTED]') === false) throw new RuntimeException('No actual redacted log written');
    foreach ([$secret, $token, $responseSecret] as $value) {
        if (strpos($contents, $value) !== false) throw new RuntimeException('Sensitive value reached log');
    }
    echo "PASS actual API, kefu, global exception and HttpEnd logs redact credentials and tokens\n";
} finally {
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) $file->isDir() ? rmdir($file->getPathname()) : unlink($file->getPathname());
    rmdir($directory);
}
