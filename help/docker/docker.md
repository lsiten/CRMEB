# 本仓库镜像部署

请使用 `ghcr.io/lsiten/crmeb:latest` 与 [`docker/compose.yml`](../../docker/compose.yml)。

详细说明见 [GitHub Actions 构建与部署](../dev-docs/github-actions-build.md)，涵盖首次安装、数据持久化、拉取最新源码对应镜像和按提交回滚。

旧的上游 `crmebky` 镜像不包含本仓库修改，不再作为本项目部署方式。
