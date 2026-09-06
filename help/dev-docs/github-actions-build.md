# 本仓库 Docker 构建与部署

使用镜像 `ghcr.io/lsiten/crmeb:latest`，由本仓库最新成功构建的版本 Tag 源码生成。不要继续用 `ccr.ccs.tencentyun.com/.../crmebky` 上游应用镜像，它不包含本仓库的定制源码。

## 自动构建

`.github/workflows/build.yml` 在推送任意 Git Tag 后构建管理后台，并将本次后台产物、当前提交的 PHP 源码和仓库内 `vendor/` 放进镜像。**不构建 H5 或小程序**，保留仓库中已有移动端静态资源。

镜像包含 PHP 7.4、Nginx、队列、定时任务和 Workerman；MySQL 和 Redis 由 Compose 独立运行。项目入口明确不支持 PHP 8，因此暂时沿用 PHP 7.4。管理后台使用 Node.js 22.19.0、pnpm 11.22.0 与冻结锁文件构建，默认同站 API，可通过 Actions Variable `VUE_APP_API_URL` 调整公开 API 地址。

amd64 和 arm64 分别在原生 runner 构建，启动冒烟检查通过后发布：

- `<版本 Tag>`：与 Git Tag 对应的镜像版本，例如 `docker-20260906-1`；不符合 Docker 标签格式的字符由 metadata-action 规范化。
- `latest`：最近成功发布的版本 Tag 的双架构镜像。
- `sha-<完整提交 SHA>`：固定源码版本，用于可追溯部署和回滚。

普通分支推送不触发发布，PR 只验证构建。Actions 页面手动选择一个 Tag 时可以重新构建该版本，选择分支时只验证、不发布。构建失败时 `latest` 保留上次成功版本，应先检查 Actions 结果。

## 触发新版本

先将需要发布的最新源码提交并推送，再创建版本 Tag：

```sh
git tag docker-20260906-1
git push origin docker-20260906-1
```

后续发布请替换为新的版本号。构建检出 Tag 指向的准确提交，不会混入后续分支改动；已有 Tag 不应移动。

## 在其他服务器部署

从本仓库取得 `docker/compose.yml`，放入固定部署目录。在同目录创建 `.env`：

```dotenv
MYSQL_ROOT_PASSWORD=替换为自己的强密码
MYSQL_PASSWORD=替换为自己的业务数据库密码
CRMEB_PORT=8011
CRMEB_TAG=latest
```

执行：

```sh
docker compose pull
docker compose up -d
```

若 GHCR 提示未授权，需要使用具备 `read:packages` 权限的 GitHub 凭据执行 `docker login ghcr.io`；需要匿名部署时，在 GitHub 的 CRMEB Package settings 中将包可见性设为 Public。仓库公开不代表新建包自动公开。

访问 `http://服务器地址:8011` 完成安装。安装器中数据库主机填 `mysql`、端口 `3306`、库名/用户均为 `crmeb`，密码填 `.env` 中的 `MYSQL_PASSWORD`；Redis 主机填 `redis`、端口 `6379`、密码留空。数据库和 Redis 仅在 Compose 内部网络可见。配置反向代理和 HTTPS 后使用实际业务域名。

安装器生成的 `.env`、`.constant` 和安装锁保存在 `app-state` 卷；上传、缓存、备份和数据库也独立持久化。初次安装完成前，队列、定时任务和 Workerman 等待安装锁，不访问未初始化的数据库。

## 获取最新源码对应镜像

等待目标版本 Tag 的 Actions 成功后，在既有部署目录执行：

```sh
docker compose pull app
docker compose up -d --no-deps app
```

`pull_policy: always` 会在启动时检查远程镜像，但运行中的容器不会自动替换。需要执行以上命令更新。**不要挂载整个 `/var/www/crmeb` 或 `public/admin`，否则旧文件会覆盖新镜像中的代码。** 同一部署目录/Compose 项目名必须保持一致，才能复用已有数据卷。

检查实际运行版本：

```sh
docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$(docker compose ps -q app)"
```

回滚时将 `.env` 中 `CRMEB_TAG` 改为 `sha-<目标提交 SHA>`，再执行上述更新命令。数据库迁移不在此构建流程中自动执行；升级前备份，并按相应版本说明处理数据迁移。

## 验证范围

GitHub 检查两种架构镜像的 PHP 扩展、Composer 自动加载、Nginx/PHP-FPM 配置、HTTP 健康端点、后台静态页面和安装页面。构建上下文排除本机 `.env`、`.constant`、安装锁、上传和运行数据，保留安装 SQL。本检查不等同于已安装业务系统的交易验收。

## 运行时依赖快照

PHP 7.4 基础镜像使用 Debian 11。其安全更新源在本次构建时仍提供索引，但部分索引引用的软件包已从源站移除；CDN 缓存命中时可下载，未命中则返回 404。因此 Dockerfile 固定使用 Debian 官方 `20260901T000000Z` 快照，保证软件包与索引一致。仅针对冻结快照关闭索引有效期检查，APT 签名和软件包哈希校验保留。后续升级 PHP/系统运行时应另行验证兼容性。
