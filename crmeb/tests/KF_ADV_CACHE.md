客服广告缓存兼容契约（实施前同步）

- 逻辑键 `kf_adv` 保持不变，物理键 `tenant:<id>:kf_adv`，不改变现有 varchar(32) 主键、索引或数据库 schema。
- 与 open_adv 使用同一租户广告缓存策略。读取、写入、存在检查、删除、过期清理与闭包刷新均按当前租户执行。
- 旧 `kf_adv` 仅由其 tenant_id 对应租户回读；初始化仅插入，冲突保留值和时间；管理保存允许更新。初始化在事务内锁定读取实际记录并校验归属，再删除本租户旧键。删除同时清除本租户新旧键，刷新不能复活旧值。其他租户旧记录保持不变。
- HTTP 请求、响应、认证、错误码、金额和分页不变；明镜/星舟无需字段适配。游客成功/业务错误缓存头及坐席402仅定位，另行决定后续范围。
- 仅在新建隔离 MySQL/Redis 和独立端口测试，网关固定 #52 8003def25d26c77f678aed8d86716126aed09fcc；不清全站缓存、不迁移现有库。

回归命令（macOS，需已有 PHP7.4、MySQL8、Redis、Nginx/njs）：

```sh
KF_NGINX=/path/to/nginx KF_NJS_MODULE=/path/to/ngx_http_js_module.so bash crmeb/tests/run_kf_adv_cache.sh
KF_CACHE_BASELINE=1 KF_NGINX=/path/to/nginx KF_NJS_MODULE=/path/to/ngx_http_js_module.so bash crmeb/tests/run_kf_adv_cache.sh
```

第二条仅在隔离副本恢复 #51 两个缓存实现文件，预期失败，用于复现原缺陷。
默认端口 47961/47962/47963/47964（最后一个仅预留检查），可用既有 TENANT_HEADER_* 环境变量覆盖。
脚本从 Git 读取固定 #52 网关，仅替换本地端口、路径和 FPM socket；结束自动停止本轮子进程并删除临时数据。
71 项广告断言包含串行游客 HTTP 和服务/数据库检查，覆盖两键的两租户兼容、CRUD/刷新与碰撞回滚；40 次并发保存是 PHP 进程直接调用服务，不是管理保存 HTTP 并发。

原子初始化增量：读取缺失后的默认值/闭包刷新仅尝试插入新键，冲突时不修改已有值或时间字段；事务锁定读取实际记录并校验归属，再清理本租户旧键。管理保存仍可覆盖。HTTP 与响应缓存策略不变。

初始化回归可独立运行（无需 Nginx）：

```sh
KF_ATOMIC_ONLY=1 bash crmeb/tests/run_kf_adv_cache.sh
KF_ATOMIC_ONLY=1 KF_ATOMIC_BASELINE=1 bash crmeb/tests/run_kf_adv_cache.sh
```

第二条在隔离副本恢复 #55 原 SHA `518df322568917002ee1af12b128460cfa9dc48e`，预期失败。
初始化测试以真实 MySQL 和 DAO 确定性调度固化冷缓存/旧键迁移交错，并覆盖闭包刷新、空默认值、归属冲突及另一租户旧键；这不是实际 HTTP 并发。
完整命令默认先运行初始化测试，再执行既有 71 项广告断言。

已记录证据（产品基准 `3b9e2d3e9758a9375bee6dbd05c704bf8b266e5f`，本次文档修订不重跑业务测试）：

- 作者及明镜非作者复审均记录：旧 `518df322568917002ee1af12b128460cfa9dc48e` 初始化 96 项中 32 失败，新版 96/96 通过。覆盖两键、两租户、冷缓存/旧键迁移、读间/闭包保存、空默认值及归属保护。
- 71 项广告和 119 项既有租户/凭据/登录回归通过。初始化是实际 MySQL＋DAO 确定性交错，游客 HTTP 是串行，40 次并发是 PHP 进程直接保存；未验证 HTTP 并发读写压测、真实管理保存 HTTP 竞争、生产多节点。
- 明镜外部测试副本追加保存后跨秒、整行严格相等断言：旧版 112 项中 48 失败，新版 112/112；16 组交错的 value、expire_time、add_time 保留。扩展未入仓库，默认脚本仍为 96 项。
- 原始命令及日志见 LSIT-21 附件 `atomic-initialization-evidence.zip` 与 `atomic-independent-review.zip`。功能复审结论保留，文档一致性待核清后由知衡裁定缺陷关闭；不替代整项服务端审查。完整坐席/消息、生产接入、其他客户端及支付库存队列未验。

PR #55 相对 #51 `45087ac89aba19a6eade17840babf39bf125b78b` 累计 6 个文件；原子初始化提交 `3b9e2d3e9758a9375bee6dbd05c704bf8b266e5f` 相对 `518df322568917002ee1af12b128460cfa9dc48e` 增量 5 个文件，均在 crmeb/。本次仅追加 KF_ADV_CACHE.md 文档修订，累计仍为 6 文件；产品代码与测试脚本不变。
