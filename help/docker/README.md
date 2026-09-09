# Docker 部署

本项目的部署镜像为 **`ghcr.io/lsiten/crmeb:latest`**，由本仓库 GitHub Actions 构建，包含 最新成功发布的版本 Tag 对应的 PHP 源码和管理后台。不构建 H5 或小程序。

请使用仓库中的 [`docker/compose.yml`](../../docker/compose.yml)，完整部署、升级和回滚说明见 [GitHub Actions 构建与部署](../dev-docs/github-actions-build.md)。

更新已有部署：

```sh
docker compose pull app
docker compose up -d --no-deps app
```

本目录的旧 `docker-compose.yml` 是挂载本地源码的开发方案，不作为新环境部署入口。上游 CRMEB 镜像不含本仓库定制代码，请勿用作本项目发布镜像。

租户凭据 Header 需要下划线透传及重复头检查，见 [网关交接与隔离验证](../dev-docs/tenant-header-gateway.md)。旧开发 Compose 的 nginx 服务需使用配套 Dockerfile 重新构建（在本目录执行 `docker compose build nginx`），从仓库根上下文读取共享编译脚本。冻结 Bullseye 源不含 njs 二进制包，构建会校验固定 njs 源码摘要，并使用同版本 Debian Nginx 源码在目标架构编译、检查模块加载。运行时挂载共享 `docker/tenant-headers.js`；不可只复制站点配置到不含模块的镜像。
