# 租户配置复制回归

`TenantConfigServices` 必须为源读取、目标查重和插入各创建独立查询。
ThinkORM 查询对象会保留 `where` 与 `field`：复用后目标查询可能同时要求
`tenant_id=1 AND tenant_id=2`，插入又被先前字段筛选限制，报
`fields not exists:[type]`，即使真实表存在 `type`。这不是缺字段迁移。

## 隔离运行

仅使用新建、可删除的独立 MySQL 实例和数据库，不对现有商城执行。
本轮 PHP 7.4.33 / MySQL 8.0.46，MySQL 43501、Redis 43502、HTTP 43503。

1. 创建全新 `lsit21_config_test_<唯一后缀>` 数据库，独立 checkout 的 `.env`
   指向它，缓存和 Redis 也必须独立。
2. 导入 `public/install/crmeb.sql`。旧安装数据包含零日期，导入连接使用
   `--init-command="SET SESSION sql_mode=''"`；不要修改实例全局 SQL mode。
3. 在 `crmeb/` 执行 `php think tenant:upgrade`。本轮扫描158表，新增153个租户字段。
4. 执行
   `TENANT_CONFIG_TEST_DATABASE=lsit21_config_test_<唯一后缀> php tests/tenant_config_sync_mysql.php`。
   未设置独立库名直接拒绝；与实际数据库不符也拒绝。用事务创建临时租户并回滚。
5. HTTP 联调才需要再导入 `upgrade/tenant_credentials.sql`，创建第二租户并调用
   `TenantConfigServices::syncTenant(2)`；生成两租户凭据，将公开 entry 映射到各自
   client_id；使用正式 `public/index.php` 和路由，不增加测试业务路由。
6. 结束关闭本轮精确服务进程、删除本轮数据库/缓存并恢复临时配置。

32项断言覆盖完整复制七类配置、源不变、目标已有自定义值不被覆盖、不重复插入、
二次同步返回0，以及无效目标/源自身不执行复制。原实现退出1，修复退出0；
撤销修复再失败，重新应用后通过。依赖 vendor 的测试不计为项目覆盖。

## 本轮真实 HTTP 边界

完整安装 SQL + 正式租户升级，未臆造字段。两店商品通过隔离 seed 分配，
并把 `site_name` 设置成不同值以防 HTTP 200 掩盖串配置。

- 两店 bootstrap、site_config、theme_info/home、index、products 返回HTTP200/业务200；
  主题 `value` 非空，商品甲 `[4,3,1]`、乙 `[2]`。
- **basic_config 与 index 的乙站点名错误**：返回甲名。绑定乙上下文调用
  `SystemConfigService::get('site_name', '', false)` 返回正确乙名，缓存调用返回甲名；
  `crmeb/services/SystemConfigService.php` 使用不带租户的全局缓存键。
- **乙 get_open_adv 业务400**：`eb_cache` 主键只有 `key`，甲已存在 `open_adv`，
  乙按租户过滤后尝试再次插入相同键，产生1062重复主键。

因此本修复只闭合配置复制报错，不代表乙首页通过。两项缓存问题交知衡确定后续范围，
本次不改变缓存协议或数据库索引。请求、响应、认证、分页、金额契约无变更。
未执行浏览器/双客户端编译/真机/支付库存队列/WebSocket验证，不替代暂停的整项服务端审查。
本轮直接调用同步服务；未动态回归后台新增租户入口及“先有第二租户再执行升级”的命令路径。

## 后续缓存增量

以上“乙站点名错误/广告400”为配置复制修复首次验证时的历史结果。
后续本PR补充缓存命名与完整读写失效修复，独立库缓存69项、正式HTTP65项通过，
详见 `TENANT_CACHE.md`。原32项同步回归仍保留并通过；完整业务及非作者验收边界不变。
