-- Multi-tenant schema migration (safe to run once on an existing installation).
CREATE TABLE IF NOT EXISTS `eb_tenant` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL DEFAULT '',
  `code` varchar(64) NOT NULL DEFAULT '',
  `status` tinyint(1) UNSIGNED NOT NULL DEFAULT '1',
  `add_time` int(10) UNSIGNED NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`), UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户主表';
INSERT IGNORE INTO `eb_tenant` (`id`, `name`, `code`, `status`, `add_time`)
VALUES (1, '默认租户', 'default', 1, UNIX_TIMESTAMP());
-- 为所有业务表补充租户字段和索引。脚本可重复执行，租户主表本身不参与隔离。
DELIMITER //
CREATE PROCEDURE `crmeb_upgrade_tenant_columns`()
BEGIN
  DECLARE finished INT DEFAULT 0;
  DECLARE table_name_value VARCHAR(128);
  DECLARE has_column INT DEFAULT 0;
  DECLARE has_index INT DEFAULT 0;
  DECLARE table_cursor CURSOR FOR
    SELECT TABLE_NAME FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME LIKE 'eb_%' AND TABLE_NAME <> 'eb_tenant';
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished = 1;

  OPEN table_cursor;
  tenant_table_loop: LOOP
    FETCH table_cursor INTO table_name_value;
    IF finished = 1 THEN LEAVE tenant_table_loop; END IF;

    SELECT COUNT(*) INTO has_column FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = table_name_value AND COLUMN_NAME = 'tenant_id';
    IF has_column = 0 THEN
      SET @tenant_sql = CONCAT('ALTER TABLE `', table_name_value,
        '` ADD COLUMN `tenant_id` INT UNSIGNED NOT NULL DEFAULT 1 COMMENT ''租户ID''');
      PREPARE tenant_stmt FROM @tenant_sql;
      EXECUTE tenant_stmt;
      DEALLOCATE PREPARE tenant_stmt;
    END IF;

    SELECT COUNT(*) INTO has_index FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = table_name_value AND COLUMN_NAME = 'tenant_id';
    IF has_index = 0 THEN
      SET @tenant_sql = CONCAT('ALTER TABLE `', table_name_value,
        '` ADD INDEX `idx_tenant_id` (`tenant_id`)');
      PREPARE tenant_stmt FROM @tenant_sql;
      EXECUTE tenant_stmt;
      DEALLOCATE PREPARE tenant_stmt;
    END IF;

    SET @tenant_sql = CONCAT('UPDATE `', table_name_value,
      '` SET `tenant_id` = 1 WHERE `tenant_id` IS NULL OR `tenant_id` = 0');
    PREPARE tenant_stmt FROM @tenant_sql;
    EXECUTE tenant_stmt;
    DEALLOCATE PREPARE tenant_stmt;
  END LOOP;
  CLOSE table_cursor;
END//
DELIMITER ;
CALL `crmeb_upgrade_tenant_columns`();
DROP PROCEDURE `crmeb_upgrade_tenant_columns`;

-- 后台动态菜单：幂等写入“租户管理”，挂载到“维护”(id=25)菜单下。
INSERT INTO `eb_system_menus`
(`pid`, `icon`, `menu_name`, `module`, `controller`, `action`, `api_url`, `methods`, `params`, `sort`, `is_show`, `is_show_path`, `access`, `menu_path`, `path`, `auth_type`, `header`, `is_header`, `unique_auth`, `is_del`, `mark`)
SELECT 25, '', '租户管理', 'admin', 'setting.tenant', 'adminList', '/setting/tenant', 'GET', '[]', 20, 1, 1, 1, '/system/tenant', '25', 1, 'setting', 0, 'admin-tenant-index', 0, '租户管理'
WHERE NOT EXISTS (SELECT 1 FROM `eb_system_menus` WHERE `unique_auth` = 'admin-tenant-index' AND `is_del` = 0);
