-- Multi-tenant schema migration (safe to run once on an existing installation).
CREATE TABLE IF NOT EXISTS `eb_tenant` (
  `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL DEFAULT '',
  `code` varchar(64) NOT NULL DEFAULT '',
  `status` tinyint(1) UNSIGNED NOT NULL DEFAULT '1',
  `add_time` int(10) UNSIGNED NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`), UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户主表';
ALTER TABLE `eb_system_admin` ADD COLUMN `tenant_id` int(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '租户ID' AFTER `id`;
ALTER TABLE `eb_user` ADD COLUMN `tenant_id` int(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '租户ID' AFTER `uid`;
ALTER TABLE `eb_store_product` ADD COLUMN `tenant_id` int(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '租户ID' AFTER `id`;
ALTER TABLE `eb_store_order` ADD COLUMN `tenant_id` int(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '租户ID' AFTER `id`;
CREATE INDEX `tenant_id` ON `eb_system_admin` (`tenant_id`);
CREATE INDEX `tenant_id` ON `eb_user` (`tenant_id`);
CREATE INDEX `tenant_id` ON `eb_store_product` (`tenant_id`);
CREATE INDEX `tenant_id` ON `eb_store_order` (`tenant_id`);
ALTER TABLE `eb_system_timer` ADD COLUMN `tenant_id` int(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '租户ID' AFTER `id`;
CREATE INDEX `tenant_id` ON `eb_system_timer` (`tenant_id`);
ALTER TABLE `eb_store_product_relation` ADD COLUMN `tenant_id` int(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '租户ID' AFTER `id`;
CREATE INDEX `tenant_id` ON `eb_store_product_relation` (`tenant_id`);
ALTER TABLE `eb_store_product_attr_value` ADD COLUMN `tenant_id` int(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '租户ID' AFTER `id`;
CREATE INDEX `tenant_id` ON `eb_store_product_attr_value` (`tenant_id`);
ALTER TABLE `eb_theme_download` ADD COLUMN `tenant_id` int(10) UNSIGNED NOT NULL DEFAULT '0' COMMENT '租户ID' AFTER `id`;
CREATE INDEX `tenant_id` ON `eb_theme_download` (`tenant_id`);

-- 后台动态菜单：幂等写入“租户管理”，挂载到“维护”(id=25)菜单下。
INSERT INTO `eb_system_menus`
(`pid`, `icon`, `menu_name`, `module`, `controller`, `action`, `api_url`, `methods`, `params`, `sort`, `is_show`, `is_show_path`, `access`, `menu_path`, `path`, `auth_type`, `header`, `is_header`, `unique_auth`, `is_del`, `mark`)
SELECT 25, '', '租户管理', 'admin', 'setting.tenant', 'adminList', '/setting/tenant', 'GET', '[]', 20, 1, 1, 1, '/system/tenant', '25', 1, 'setting', 0, 'admin-tenant-index', 0, '租户管理'
WHERE NOT EXISTS (SELECT 1 FROM `eb_system_menus` WHERE `unique_auth` = 'admin-tenant-index' AND `is_del` = 0);
