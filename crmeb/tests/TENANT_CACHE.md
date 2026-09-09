# 租户配置与开屏广告缓存

本增量处理站点名串租户和 open_adv 主键冲突，沿用 PR #50 的配置复制修复。
接口请求/响应、认证、业务错误码、分页、金额均不变。仅适配 open_adv 数据库缓存，
其他逻辑数据库缓存键不在本轮范围内。

## 命名和失效

- 配置单项与聚合分别为 `tenant:<id>:system_config:v2:one:<key>`、
  `tenant:<id>:system_config:v2:many:<serialized-keys-md5>`，使用同租户独立标签。
  旧全局键可能已经串租户，任何租户（含默认1）都不回读；首次按数据库重建。
- SystemConfigDao 的增/改/删/批量改，以及沿其执行的 saveAll，失效本租户标签。
  配置控制器和配置服务刷新改为本租户配置清理；初始化复制显式失效目标租户。
  原 CacheService::clear 默认入口额外清理当前租户配置，以保持其他既有刷新调用的兼容；
  其原有 crmeb 标签清理语义保留。修复和回归不调用全站 clearAll / Redis FLUSH。
- 广告物理键为 `tenant:<id>:open_adv`，整型租户ID可容纳于既有 varchar(32) 主键；
  不增加字段、索引或迁移。读取缺少新键时，只兼容 tenant_id 属于当前租户的旧 open_adv。
- 广告写入在事务中原子 INSERT ... ON DUPLICATE KEY UPDATE，再删除当前租户旧键；
  物理键归属异常会抛错并回滚，不能覆盖其他租户。删除处理当前租户的新旧键，防止旧值复活。
  存在检查遵守相同兼容读取，过期清理由现有租户模型范围执行；过期后闭包按既有行为刷新。
  默认租户1遵守同样规则。无广告时沿用原成功响应（data 字段可能省略）。

旧全局配置键无需清空；它们不再参与读取。广告新格式写入后若回退旧代码，旧代码无法读取
新键，必须先导出保留广告内容并制定恢复方案；旧全局主键不能同时表示多租户广告，不能
通过直接回退代码或全站清空缓存恢复多租户业务。未对现有环境执行此类操作。

## 可复现验证

仅在新建可删除 MySQL/Redis、独立 checkout 中运行。复用 `TENANT_CONFIG_SYNC.md`
的完整安装SQL→tenant:upgrade→tenant_credentials.sql顺序，无测试假字段。
HTTP需要两店1/2、`store-a`/`store-b`公开bootstrap映射、同步后的真实配置/主题；
安装商品2的相关数据归属乙，其余安装商品归属甲。脚本会改动独立库配置与广告，请勿对现有库运行。

本轮 PHP7.4.33 / MySQL8.0.46 / Redis8.8.0；独立端口43601/43602/43603：

```sh
TENANT_CONFIG_TEST_DATABASE=lsit21_config_test_43601 php tests/tenant_cache_mysql.php
TENANT_CONFIG_TEST_DATABASE=lsit21_config_test_43601 TENANT_CACHE_HTTP_URL=http://127.0.0.1:43603 php tests/tenant_cache_http.php
TENANT_CONFIG_TEST_DATABASE=lsit21_config_test_43601 php tests/tenant_config_sync_mysql.php
TENANT_TEST_DATABASE=lsit21_test_43601cace TENANT_TEST_PORT=43601 php tests/tenant_credentials_test.php
```

缓存回归69项：读写、增删批量改失效、甲缓存未被乙清除、默认租户、旧键归属与删除、
过期刷新、8个并发进程各10次写入、每租户一条记录、异常归属碰撞回滚。
HTTP65项：正式 public/index.php/路由，甲乙两种次序冷/热读取，站点名及完整广告内容，
乙变更后的甲乙结果，旧广告HTTP读取/写入后热读、无广告默认，主题和商品归属。
配置写入通过真实服务/DAO，未验证后台表单提交；HTTP未替代浏览器、双端或真机验收。

原实现初步探针重现乙单项/聚合串值及广告1062；撤回两个读取服务再次exit1，重应用exit0。
既有同步32项、凭据48项保留通过。新增脚本拒绝未声明的独立库，HTTP额外限制loopback URL。
本轮增量自检不替代知衡安排的交付后非作者复审，也不替代此前暂停的整项服务端审查。
