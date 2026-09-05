<?php

namespace crmeb\command;

use think\console\Command;
use think\console\Input;
use think\console\Output;
use think\facade\Config;
use think\facade\Db;

/** Upgrade every application table to the tenant-aware schema. */
class Tenant extends Command
{
    protected function configure()
    {
        $this->setName('tenant:upgrade')
            ->setDescription('Add tenant isolation columns and indexes to all application tables');
    }

    protected function execute(Input $input, Output $output)
    {
        $database = Db::query('SELECT DATABASE() AS name')[0]['name'] ?? '';
        $prefix = (string)Config::get('database.connections.' . Config::get('database.default') . '.prefix');
        if (!$database || !$prefix) return $output->error('无法确定当前数据库或表前缀');

        $tables = Db::query(
            'SELECT TABLE_NAME AS name FROM information_schema.tables WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = \'BASE TABLE\' AND TABLE_NAME LIKE ?',
            [$database, $prefix . '%']
        );
        $added = $updated = $skipped = 0;
        foreach ($tables as $tableInfo) {
            $table = (string)$tableInfo['name'];
            if ($table === $prefix . 'tenant') {
                $skipped++;
                continue;
            }
            $quotedTable = '`' . str_replace('`', '``', $table) . '`';
            $columns = Db::query(
                'SELECT COLUMN_NAME AS name FROM information_schema.columns WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = \'tenant_id\'',
                [$database, $table]
            );
            if (!$columns) {
                Db::execute("ALTER TABLE {$quotedTable} ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT '租户ID'");
                $added++;
            }
            $indexes = Db::query(
                'SELECT DISTINCT INDEX_NAME AS name FROM information_schema.statistics WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = \'tenant_id\'',
                [$database, $table]
            );
            if (!$indexes) Db::execute("ALTER TABLE {$quotedTable} ADD INDEX `idx_tenant_id` (`tenant_id`)");
            $updated += (int)Db::execute("UPDATE {$quotedTable} SET `tenant_id` = 1 WHERE `tenant_id` IS NULL OR `tenant_id` = 0");
        }
        $output->info(sprintf('租户升级完成：扫描 %d 张表，新增字段 %d 张，回填 %d 行，跳过租户主表 %d 张。', count($tables), $added, $updated, $skipped));
    }
}
