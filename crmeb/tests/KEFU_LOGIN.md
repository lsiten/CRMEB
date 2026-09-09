## 坐席登录与认证租户契约（磐石，实施前同步）

- 固定基准 #55 `8fb0cb1022a4d07fe4cfcc93556d2f8ea600481d`，仅 crmeb/ 独立增量，不改变现有 PR base、不合并部署。
- `POST /kefuapi/login` 保留 account/password 和既有验证码流程，新增可选字符串 tenant_code；trim 后最长64字符。省略、空串、纯空白走全局唯一有效坐席账号路径（账号与所属租户均启用）；显式 null、非字符串、超长统一 HTTP200/业务400“租户编码格式错误”。
- 非空编码仅查询唯一匹配的启用租户内有效账号；未知/停用编码、账号不存在或歧义、错误密码均 HTTP200/业务400“账号或密码错误”。不按密码猜租户，不回落默认租户。tenant_code 为公开定位字段，不替代游客 appid/screct_id Header。
- 成功信封仍为 status/msg/data，data 保持 token/exp_time/kefuInfo；坐席独立 Bearer、既有头名、金额及分页不变。签发 JWT 与登录状态更新使用账号真实 tenant_id，完成或异常后恢复调用前上下文。PC/移动输入由明镜负责；UniApp/Taro 无需适配。
- 后续坐席认证验证 JWT 签名、有效期和 type=kefu，再使用可信 tenant_id；重新查询坐席并核对归属、坐席与租户启用状态，以及令牌桶 uid/type/token。无效、过期、跨类型或归属不符令牌统一沿用业务402，不接受请求中的租户字段覆盖 JWT。缺失 tenant_id 的历史已签名坐席令牌仅允许默认租户账号；显式 null/非正整数声明拒绝，非默认租户须重新登录。
- parseToken 自身恢复调用前上下文；HTTP中间件仅在下游执行期间绑定核验后坐席租户，强制启用作用域，finally恢复原上下文（含原跨租户标志；不改游客绑定）。不全局关闭作用域。扫码内部调用保留原租户下已确认坐席定位，不扩展二维码协议或宣称完整扫码/Socket通过。
- 后台既有 `GET /adminapi/app/wechat/kefu/login/:id`（以实际路由前缀为准）由既有后台认证/权限保护，保留一键进入客服；内部改按当前租户内坐席ID签发，不再经免密码账号全局查找。不增加公开免密码路由，不改变后台请求/响应。此兼容补充只修改 crmeb/ 后台控制器一行及服务方法；后台与扫码仍须坐席/租户启用。
- 验证使用全新隔离 MySQL/Redis、正式 HTTP 路由，覆盖唯一/同名账号、格式/错误编码/歧义/停用/密码拒绝、两租户 login→info/record、JWT归属/类型/有效期及上下文正常/异常恢复。真实浏览器组合由准确SHA交付后另行复验；无生产接入或全商城验收结论。

### 可重复验证

在仓库根执行：

```sh
bash crmeb/tests/run_kefu_login.sh
KEFU_LOGIN_BASELINE=1 bash crmeb/tests/run_kefu_login.sh
TENANT_TEST_PHP=/opt/homebrew/opt/php@7.4/bin/php \
TENANT_TEST_MYSQLD=/opt/homebrew/opt/mysql@8.0/bin/mysqld \
TENANT_TEST_PORT=47968 bash crmeb/tests/run_tenant_tests.sh
```

新脚本默认使用本机已有 PHP7.4/MySQL8；可通过 TENANT_HEADER_PHP、TENANT_HEADER_MYSQLD 覆盖，PATH 需有 mysql、redis-server、rsync、openssl、lsof。不会安装依赖。默认端口47961/47962/47963（另检查47964），若占用即退出；可用对应 TENANT_HEADER_*_PORT 覆盖。

每次创建随机临时目录、全新 MySQL 数据目录及随机数据库、无持久化 Redis，复制产品时排除 .env/runtime/install.lock，运行正式 PHP HTTP 路由。EXIT trap 结束本次子进程并删除临时库/配置；不访问现有数据库、不清全局生产缓存。仅测试临时库内删除 code 唯一索引以验证 schema 漂移的拒绝路径，不是产品迁移。

BASELINE=1 仅把临时产品副本的五个修改源码文件恢复为固定8fb0cb1，测试脚本和夹具相同。新版125项断言通过；旧版应失败。两版断言总数不同，因为登录失败时跳过需要token的成功链路。

HTTP部分包括真实密码登录、验签读取JWT归属、甲乙两种顺序info与record，数据包含相同user_id但不同tenant_id的干扰记录；对返回记录ID/租户及站点配置作断言。还覆盖编码边界、同名账号不同密码、停用、无效/跨类型/撤销/错误归属令牌。上下文异常、扫码缓存与后台内部ID签发是同进程服务/中间件验证，不冒充微信扫码或真实后台浏览器验收；下游异常与token写失败为受控注入。

成功路径仍沿用现有坐席消息和会话协议，本次未验证Socket连接/消息送达、OAuth、完整后台一键登录浏览器、Nginx/njs及前端新输入组合、生产接入、支付库存队列。真实组合复验须使用本分支准确SHA与明镜交付的前端SHA，不读在途树。
