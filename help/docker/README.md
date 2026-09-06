# Docker 部署

本项目的部署镜像为 **`ghcr.io/lsiten/crmeb:latest`**，由本仓库 GitHub Actions 构建，包含 `master` 最新成功构建的 PHP 源码和管理后台。不构建 H5 或小程序。

请使用仓库中的 [`docker/compose.yml`](../../docker/compose.yml)，完整部署、升级和回滚说明见 [GitHub Actions 构建与部署](../dev-docs/github-actions-build.md)。

更新已有部署：

```sh
docker compose pull app
docker compose up -d --no-deps app
```

本目录的旧 `docker-compose.yml` 是挂载本地源码的开发方案，不作为新环境部署入口。上游 CRMEB 镜像不含本仓库定制代码，请勿用作本项目发布镜像。
