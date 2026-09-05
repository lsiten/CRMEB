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
