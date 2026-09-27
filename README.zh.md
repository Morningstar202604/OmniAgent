# OmniAgent（`oa`）—— 万物皆可插件的通用智能体

> 一个底座，N 个专业。不用插件时它是通用万能 Agent；加载插件后，它瞬间变成该垂直领域的专业 Agent，卸下即恢复。


[![version](https://img.shields.io/badge/version-0.1.7-6366f1)](https://gitcode.com/badhope/OmniAgent)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D22.19-339933)](package.json)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D11.0-F69220)](package.json)
[![platform](https://img.shields.io/badge/platform-Web%20%7C%20CLI%20%7C%20Desktop-0ea5e9)](#快速开始)

> 官网：**[x33834.github.io/OmniAgent](https://x33834.github.io/OmniAgent/)** — 产品介绍、截图与文档

## 产品截图

| 桌面端首页 —— 通用底座（浅色） | 金融终端 |
|:---:|:---:|
| ![OmniAgent 桌面端浅色首页：通用底座 Hero 与能力卡片](frontend-screens/11-web-profile-generic-hero.png) | ![金融终端：行情条轮询、指数 K 线、券商研报与公司公告](frontend-screens/02-finance-terminal-full.png) |

| Agent 写策略代码 + 一键导出 PDF 报告 | 插件市场 |
|:---:|:---:|
| ![Agent 用 Python 编写回测策略并一键导出 PDF 报告](frontend-screens/15-dock-fix-navigates-to-chat.png) | ![插件市场：一键启用官方领域包（金融 / 电商 / 通用增强）](frontend-screens/mobile-03-plugin-market.png) |

| 全局命令面板（Ctrl / ⌘ + K） | 移动端首页（响应式） |
|:---:|:---:|
| ![全局命令面板：新建会话、插件专区、浅色/深色/跟随系统主题切换](frontend-screens/mobile-04-command-palette.png) | ![手机视口下的响应式移动端首页](frontend-screens/mobile-01b-home-hero.png) |

## 定位

OmniAgent 不是某个单一行业的专用 agent，而是一个**万物皆可插件**的智能体平台：

- **底座是通用全能 Agent**：不挂任何插件，文件、执行、搜索、推理、工具链与 Web UI 全部开箱可用——先有一个功能完整、能应对任何日常任务的基础 agent。
- **领域能力全部来自插件**：把垂直领域的专业知识、专业工具（乃至专业界面）打包成插件。加载插件，同一 agent 立即获得该领域的专业能力与 persona；卸载插件，恢复通用底座，**通用能力全程不受影响**。
- **用的时候打开下载**：需要某个垂直领域时，打开插件页、下载/安装、启用。加载插件的瞬间，界面与工具集随之变成对应的高级应用；平时不用，它就是一个通用万能 Agent。
- **一套底座统一所有垂直领域**：垂直领域层出不穷、各自为战、始终无法统一的局面，由"统一底座 + 插件生态"解决——领域能力以插件增量叠加，不各自造轮子。

项目由 [badhope](https://github.com/X33834) 维护，已在四个平台同步镜像：[GitHub · X33834](https://github.com/X33834/OmniAgent) · [GitHub · Morningstar202604](https://github.com/Morningstar202604/OmniAgent) · [GitCode · badhope](https://gitcode.com/badhope/OmniAgent) · [Gitee · badhope](https://gitee.com/badhope/OmniAgent)。

## 快速开始

```sh
git clone https://github.com/X33834/OmniAgent.git
cd OmniAgent
pnpm install
pnpm run build
pnpm oa web
```

`pnpm run build` 准备仓库产物；`pnpm oa web` 直接使用已构建产物。Web UI 默认在 `http://127.0.0.1:3080` 启动。传入 `--no-open` 可仅运行服务器而不打开浏览器。

### 一键体验官方领域插件

Web 侧栏「**插件**」页可启停随安装提供的官方组合包（默认关闭）——启用即向当前 profile 注入该领域插件。

CLI 一次性对话（对应 profile 已内置模板）：

```bash
oa --profile finance "查一下贵州茅台的最新行情和估值"
oa --profile finance "筛选 A 股中 PE 低于 20 的公司"
oa --profile ecommerce "帮我给'无线蓝牙耳机'拓词，看下数码配件类目市场"
oa --profile ecommerce "分析这条评论：物流太慢了，包装都压坏了，客服还不回复"
```

> 领域插件默认使用内置示例数据（mock，确定性、可复核、带标记）。接入真实数据服务时把数据源切换为 `http` 并按插件文档配置 `baseURL` 与 `apiKeyEnv`。

## 官方领域插件

| 插件 | 组合包 | 工具数 | profile | 说明 |
|---|---|---|---|---|
| 金融 | `@deepseek-ai/dsh-finance` | 17 | `finance` | 行情、财务、估值、选股、K线、资金流、公告、资讯、宏观、板块、风险指标、基金/债券/可转债、金融计算、技术分析、汇率、利率 |
| 电商运营 | `@deepseek-ai/dsh-ecommerce` | 8 | `ecommerce` | 关键词拓词、标题优化、类目市场洞察、选品评估、评论分析、价格带分析、带货脚本、活动方案 |

更多领域插件按同一范式持续加入（见下文「开发一个领域插件」）。

## 插件从哪来

1. **官方组合包**：随安装提供、默认关闭，Web 插件页一键启用（`OPTIONAL_BUNDLES`）。
2. **安装外部插件**：Web 插件页或 `oa plugin --profile <p> add <spec>` 安装 npm 包 / Git 地址 / tarball / 本地路径。
3. **自己写插件**：按领域插件范式（数据契约 + 纯逻辑 + 工具 + persona + 组合包）打包，发布后即可被任何人安装。

## 开发

`pnpm run dev:web` 在一个终端里完成构建、启动，并在源码修改时重建 client bundle；`make help` 列出 Web 与 Desktop 对应的 Make target。

## 开发一个领域插件

一个领域插件 = 一个 agent 插件包 + 一个 profile 组合包，参照两个已交付示例：

```
packages/<domain>/<domain>-agent/        # 领域插件包
  src/source.ts                          # 数据契约 + 数据源（mock / http 可替换）
  src/engine.ts                          # 纯逻辑（规则/计算，确定性可复核）
  src/tools.ts                           # defineTool 定义模型可调用工具
  src/index.ts                           # Cordis 入口：注入 persona + 注册工具
  smoke.mjs                              # 数据源与纯逻辑冒烟测试
packages/bundle/<domain>/                # profile 组合包
  cordis.patch.yml                       # 插入插件行 + 默认模型路由
  package.json                           # dsh.bundle.patch 声明
```

在任意 profile 中挂载：

```yaml
- id: <domain>-agent
  name: '@deepseek-ai/dsh-<domain>-agent'
  config:
    source: mock
```

把新组合包加入 `PROFILE_TEMPLATES`（CLI 一次性 profile）与 `OPTIONAL_BUNDLES`（Web 插件页官方组合包）即可随安装提供。工具层只依赖数据契约，与具体数据源解耦；示例数据必须带 `mock` 标记并向用户明示。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/X33834/OmniAgent/discussions) 提交反馈或 bug 报告。
- 同一项目在四个平台同步镜像：[GitHub · X33834](https://github.com/X33834) · [GitHub · Morningstar202604](https://github.com/Morningstar202604) · [GitCode · badhope](https://gitcode.com/badhope) · [Gitee · badhope](https://gitee.com/badhope)。
- 博客：[CSDN](https://blog.csdn.net/weixin_56622231) · [掘金](https://juejin.cn/user/2350111542479753)。

## 引用

```bibtex
@misc{omniagent2026,
  title={OmniAgent: A Plugin-Based Universal Agent — Everything Is a Plugin},
  author={badhope},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/X33834/OmniAgent}},
}
```

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

> 本仓库为基于 DSH（DeepSeek Harness）体系的改造发布；LICENSE 中的 MIT 版权行（Copyright (c) 2026 DeepSeek）按合规要求原样保留，未作改动。
