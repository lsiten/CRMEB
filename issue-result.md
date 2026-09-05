已完成后端租户隔离修补，修改内容如下：

- `crmeb/app/services/system/admin/AdminAuthServices.php`：解析 JWT 后，将其 `tenant_id` 与当前管理员数据库记录的 `tenant_id` 比对；不一致时立即使认证失败并删除令牌缓存。兼容没有 `tenant_id` 的旧令牌，缺省采用管理员记录租户。
- `crmeb/app/adminapi/middleware/AdminAuthTokenMiddleware.php`：保留 `tenant_id=0` 作为显式租户上下文，不再使用 `?: null` 转为空上下文，避免 `TenantScope` 因上下文为空而跳过租户条件。平台管理员仍按 `level=0` 显式允许跨租户。

验证结果：

- `php -l` 通过（两个修改文件）。
- `git diff --check` 通过。
- 已验证 `TenantContext::set(0, false)` 生成 `AND tenant_id = 0` 条件，空上下文不生成条件。

当前未执行完整集成测试（仓库未发现项目自有测试套件）。
