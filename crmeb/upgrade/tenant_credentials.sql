-- Apply explicitly after tenant_migration.sql. Replace eb_ with the installation prefix.
-- No existing data is rewritten; rollback by dropping this table after disabling the new endpoints.
CREATE TABLE IF NOT EXISTS `eb_tenant_credential` (
  `tenant_id` int(10) UNSIGNED NOT NULL,
  `client_id` char(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `secret_hash` char(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  `updated_at` int(10) UNSIGNED NOT NULL,
  PRIMARY KEY (`tenant_id`),
  UNIQUE KEY `client_id` (`client_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户服务端凭据';
