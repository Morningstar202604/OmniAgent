# 使用指南

[English](usage-guide.md) | 中文

本页是使用 **OmniAgent**（`oa`）的入口。

## 启动 Web UI

从仓库源码：

```sh
pnpm install
pnpm run build
pnpm oa web
```

Web UI 默认在 `http://127.0.0.1:3080` 启动并打开浏览器；传入 `--no-open` 跳过打开。完整产品导览（会话、插件、自动化、历史、工作区、设置）见 [Web UI 指南](user/guide/index.zh.md)。

## 接入自定义模型

任何 OpenAI 兼容（或 Anthropic）端点都可经 profile patch 复用上游 `llm-pi-ai` 适配器；`u2-flash` 示例见 [README](../README.zh.md#自定义模型源)。

## 品牌仓库

- gitcode：https://gitcode.com/badhope/OmniAgent
- gitee：https://gitee.com/badhope/omniagent
- GitHub：https://github.com/Morningstar202604/OmniAgent · https://github.com/X33834/OmniAgent
