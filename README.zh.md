> 本产品 **OmniAgent** 基于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）构建，兼容其生态。

# OmniAgent

[English](README.md) | 中文

OmniAgent（`oa`）是 Fork 自 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的开源 agent harness（智能体框架），完整兼容其生态，同时承载自有品牌、扩展与发布线。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)。

文档：[https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

品牌仓库：[https://gitcode.com/badhope/OmniAgent](https://gitcode.com/badhope/OmniAgent) · 上游：[https://github.com/deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)

## 开发者预览

OmniAgent 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @deepseek-ai/dsh web
```

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

<a id="run-from-source"></a>

### 从源码运行

如需从 OmniAgent 仓库源码运行：

```sh
git clone https://gitcode.com/badhope/OmniAgent.git
cd OmniAgent
pnpm install
pnpm run build
pnpm oa web
```

`pnpm run build` 会执行完整构建链（lib host + client + native system + web）并准备全部仓库产物。`pnpm oa web` 会直接使用这些已构建产物，不会重新构建。

> 上文 `npx @deepseek-ai/dsh web` 一行命令运行的是官方上游包；OmniAgent 自身的 npm 发布将在后续里程碑中从本仓库发布。

<a id="follow-upstream"></a>

## 跟进上游

仓库将官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 保持为 `origin` 远程，用普通 `git merge` 跟进，上游的每个功能与修复都通过常规合并流程落地：

```sh
git remote add origin https://github.com/deepseek-ai/deepseek-harness.git   # 已配置
git fetch origin
git merge origin/master
pnpm install && pnpm run build
```

品牌发布线推送到 `brand` 远程（`gitcode.com/badhope/OmniAgent`，分支 `main`）：

```sh
git remote add brand https://gitcode.com/badhope/OmniAgent.git              # 已配置
git push --no-verify --force brand master:main
```

品牌调整（命名、UI 文案、官网、扩展）都叠加在上游提交之上，可经受每次合并；上游变更可能重塑部分 UI，为保持跟进最新而接受。

## 社区与支持

- 品牌主页：[https://gitcode.com/badhope/OmniAgent](https://gitcode.com/badhope/OmniAgent)
- 上游反馈与 bug 报告：[GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions)
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.zh.md)。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

`pnpm run dev:web` 会在一个终端里完成构建、启动，并在源码修改时重建 client bundle；`make help` 列出 Web 与 Desktop 对应的 Make target。完整表格见开发指南的「应用命令」一节。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

<a id="extensions"></a>

## OmniAgent 扩展

以下第一方包随 OmniAgent 品牌线发布（官方上游全部包保持不变、兼容）：

| 包 | 用途 |
| --- | --- |
| `packages/finance/finance-agent` | 金融领域智能体（行情、基本面、市场资讯） |
| `packages/ecommerce/ecommerce-agent` | 电商领域智能体（商品、内容、分析） |
| `packages/client/ui-finance` | 金融工作台 UI |
| `packages/bundle/finance` | 金融组合包（领域智能体 + UI） |
| `packages/bundle/ecommerce` | 电商组合包（领域智能体 + UI） |
| `packages/bundle/general-full` | 通用全功能组合包 |
| `packages/bundle/plugin-template` | 插件开发模板组合包 |
| `packages/memory/memory` | 跨会话记忆层（走官方注入链，`order=9500`） |
| `packages/report-export/report-export` | 报告/产物导出 |
| `packages/tools/tool-git` | Git 工具 |
| `packages/tools/tool-notify` | 通知工具 |
| `packages/client/ui-status-bar` | 工作区状态栏 UI |
| `packages/client/ui-session-history` | 会话历史面板 UI |
| `packages/subagent/agent-team` | 多智能体团队（实验性） |

<a id="custom-model"></a>

## 自定义模型源

OmniAgent 复用官方 `llm-pi-ai` 多提供商适配器，任何 OpenAI 兼容（或 Anthropic）端点都可通过 profile patch 接入。示例——`u2-flash` 模型接 OpenAI 兼容网关：

```yaml
# $DSH_HOME/profiles/<profile>/cordis.patch.yml
llm-pi-ai:
  providers:
    unisound-u2:
      api: openai-completions
      baseURL: https://maas-api.unisound.com/v1
      transport: sse
      apiKeyEnv: UNISOUND_API_KEY
  models:
    u2-flash: { provider: unisound-u2, model: u2-flash }
agent-default-model: { provider: unisound-u2, model: u2-flash }
```

以 `UNISOUND_API_KEY=<key> pnpm oa web` 启动 Web UI。设置页的模型选择器会列出所有已配置提供商。

## 引用

```bibtex
@misc{deepseek-harness2026,
  title={OmniAgent: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
