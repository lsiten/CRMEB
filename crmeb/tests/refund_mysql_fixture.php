<?php

/** Start a disposable socket-only server without reading any MySQL option files. */
function startRefundMysql(string $dir, string $binary): array
{
    if (!is_dir($dir) || !is_executable($binary)) {
        throw new RuntimeException('MySQL fixture directory or executable is unavailable');
    }
    $root = '/tmp/crmeb-mysql-' . bin2hex(random_bytes(8));
    if (!mkdir($root, 0700)) throw new RuntimeException('Cannot create MySQL fixture');
    $handle = ['process' => null, 'root' => $root];
    $data = $root . '/data';
    $socket = $root . '/mysql.sock';
    $log = $root . '/server.log';
    $environment = getenv();
    $environment['MYSQL_HOME'] = $root;
    try {
        $initialize = proc_open([$binary, '--no-defaults', '--initialize-insecure',
            '--datadir=' . $data, '--log-error=' . $log],
            [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']],
            $pipes, $root, $environment);
        if (!is_resource($initialize)) throw new RuntimeException('Cannot initialize MySQL fixture');
        fclose($pipes[0]);
        $handle['process'] = $initialize;
        $deadline = microtime(true) + 60;
        do {
            $state = proc_get_status($initialize);
            if (!$state['running']) break;
            if (microtime(true) >= $deadline) throw new RuntimeException('MySQL fixture initialization timed out');
            usleep(100000);
        } while (true);
        $exitCode = $state['exitcode'];
        proc_close($initialize);
        $handle['process'] = null;
        if ($exitCode !== 0) throw new RuntimeException('MySQL fixture initialization failed');
        $process = proc_open([$binary, '--no-defaults', '--datadir=' . $data,
            '--socket=' . $socket, '--pid-file=' . $root . '/mysql.pid',
            '--log-error=' . $log, '--skip-networking', '--mysqlx=OFF'],
            [0 => ['pipe', 'r'], 1 => ['file', $log, 'a'], 2 => ['file', $log, 'a']],
            $pipes, $root, $environment);
        if (!is_resource($process)) throw new RuntimeException('Cannot start MySQL fixture');
        fclose($pipes[0]);
        $handle['process'] = $process;
        $deadline = microtime(true) + 30;
        $pdo = null;
        do {
            if (!proc_get_status($process)['running']) throw new RuntimeException('MySQL fixture exited during startup');
            if (is_file($root . '/mysql.pid') && file_exists($socket)) {
                try {
                    $pdo = new PDO('mysql:unix_socket=' . $socket . ';charset=utf8mb4', 'root', '',
                        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
                    break;
                } catch (PDOException $error) {
                    if (microtime(true) >= $deadline) throw $error;
                }
            }
            if (microtime(true) >= $deadline) throw new RuntimeException('MySQL fixture startup timed out');
            usleep(100000);
        } while (true);
        $pdo->exec('CREATE DATABASE refund_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        $pdo = null;
        return [$handle, ['type' => 'mysql', 'hostname' => 'localhost', 'socket' => $socket,
            'database' => 'refund_test', 'username' => 'root', 'password' => '', 'charset' => 'utf8mb4',
            'dsn' => 'mysql:unix_socket=' . $socket . ';dbname=refund_test;charset=utf8mb4',
            'prefix' => '', 'fields_strict' => true, 'trigger_sql' => false]];
    } catch (Throwable $error) {
        $details = is_file($log) ? substr(file_get_contents($log), -4000) : '';
        stopRefundMysql($handle);
        throw new RuntimeException($error->getMessage() . "\n" . $details, 0, $error);
    }
}

/** Stop only the child represented by this handle, then remove its private tree. */
function stopRefundMysql(array $handle): void
{
    $process = $handle['process'];
    if (is_resource($process)) {
        $state = proc_get_status($process);
        if ($state['pid'] === (int)getenv('REFUND_PROTECTED_PID')) {
            throw new RuntimeException('Refusing to terminate protected daemon');
        }
        if ($state['running']) {
            proc_terminate($process);
            $deadline = microtime(true) + 15;
            while (proc_get_status($process)['running'] && microtime(true) < $deadline) usleep(100000);
            if (proc_get_status($process)['running']) proc_terminate($process, 9);
        }
        proc_close($process);
    }
    $root = $handle['root'];
    if (!preg_match('#^/tmp/crmeb-mysql-[a-f0-9]{16}$#D', $root) || is_link($root)) {
        throw new RuntimeException('Invalid MySQL fixture cleanup directory');
    }
    if (!is_dir($root)) return;
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,
        FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($files as $file) {
        $file->isDir() && !$file->isLink() ? rmdir($file->getPathname()) : unlink($file->getPathname());
    }
    rmdir($root);
}
