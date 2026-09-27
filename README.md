# OmniAgent（`oa`）—— 万物皆可插件的通用智能体

> 一个底座，N 种职业。不装插件，它是一个开箱即用的通用全能 Agent；装上某个插件，同一个 Agent 立刻变成那个垂直领域的专业应用；卸下插件，立刻回归通用——**通用能力永远不被削弱**。

## 这是什么

OmniAgent 不是某一个行业专用的 Agent，而是一个「**万物皆可插件**」的通用智能体平台：

- **底座本身就是一个功能完整的通用 Agent**：文件读写、命令执行、联网搜索、推理、工具链、Web UI 在不挂任何插件时即可独立处理日常任务。
- **所有领域能力都来自插件**：把一个垂直领域的专业知识、工具（甚至整套 UI）打包成插件。装载时，同一个 Agent 瞬间获得该领域的人设、工具与专业界面；卸载后恢复通用底座——能力是**叠加**的，不是重造轮子。
- **需要时装、不用时退**：需要某个领域就打开插件市场一键启用，界面与工具集随之一切为专业应用；不用时它依然是那个通用全能 Agent。
- **一个底座统一所有垂直**：用「一个统一底座 + 插件生态」解决垂直 Agent 各自为政、永不统一的乱象。

## 快速开始

### 环境要求

- **Node.js** `^22.19.0`（或 `>=24.0.0`）
- **pnpm** `11.7.0`（仓库已锁定 `packageManager`）

### 安装

```bash
git clone <your-fork>.git omniagent
cd omniagent
pnpm install
pnpm run build        # 产出 host/client 库与 web 前端产物
```

### 配置模型 Key

OmniAgent 通过 OpenAI 兼容协议接入任意大模型端点。任选一种：

**方式一：Agnes AI（仓库自带示例 overlay）**

```bash
export AGNES_API_KEY=sk-...
```

然后启动时挂上 `config/agnes-ai.patch.yml`：

```bash
pnpm oa web --patch config/agnes-ai.patch.yml
```

**方式二：DeepSeek（finance/ecommerce 领域包已内置默认路由）**

```bash
export DEEPSEEK_API_KEY=sk-...
```

base 包同时预置了通义千问（`DASHSCOPE_API_KEY`）、智谱 GLM（`ZHIPU_API_KEY`）、Ollama（本地）等 OpenAI 兼容 provider，在 Web 设置页的「模型」中即可切换。任意 OpenAI 兼容端点（vLLM、本地模型网关等）都可照此扩展。

### 启动

```bash
# Web 界面（默认 http://127.0.0.1:3080，--no-open 不自动开浏览器）
pnpm run start:web            # 等价 pnpm oa web

# 一次性命令行对话（headless）
pnpm run dsh headless "帮我整理这个目录并写个 README"
#   等价 pnpm oa headless "..."
```

### 加载插件

有三种方式获得领域能力：

1. **Web 插件市场**：打开 Web 侧栏「插件」页，官方随包插件（默认关闭）一键启用/停用——这就是 `OPTIONAL_BUNDLES`。
2. **切换领域 profile**：直接以领域 profile 启动，界面瞬变为专业应用：
   ```bash
   pnpm oa finance "查一下贵州茅台的最新行情和估值"
   pnpm oa ecommerce "帮我给'无线蓝牙耳机'拓词"
   ```
3. **安装外部插件**：
   ```bash
   pnpm oa plugin --profile web add <npm 包名 | Git URL | tarball | 本地路径>
   ```

## 核心功能

### 通用底座（`dsh-base`，开箱即用）

对话与会话管理、会话持久化与自动标题、分支时间线、全局命令面板、顶部状态栏（模型/会话/token/连接状态/时钟/主题）、插件市场与插件管理、长期记忆与知识库、细粒度权限规则（allow/auto/ask/deny 四档 + 通配符）、后台任务队列、定时任务调度、工作区变更追踪（可回看/回滚）、OS 级系统通知、Web 端浏览器通知、MCP 客户端、技能（skill）体系、沙箱执行与审批、多模型路由。

### 已随包发布的官方插件

| 插件 | Bundle | 说明 |
|---|---|---|
| **金融终端** | `@deepseek-ai/dsh-finance` | 19 个金融工具：行情/财务/估值/K线/资金流/公告/资讯/宏观/行业/风险/固收/汇率/技术指标；多因子选股（PE/PB/ROE/涨跌幅）、双均线/定投回测、自然语言转量化代码；配套 `ui-finance` 专业面板（行情条轮询、标的详情、SVG K线、选股器表格、产业链图谱）；报告一键导出真实 PDF |
| **电商运营** | `@deepseek-ai/dsh-ecommerce` | 拓词、标题优化、市场洞察、选品评估、评论分析、价格带分析、带货话术、活动策划 |
| **通用增强** | `@deepseek-ai/dsh-general-full` | LSP 语言服务器缝、定时任务调度、产物交付（present）、工作区变更追踪、computer-use / browser-use 自动化注册表（惰性挂载，装驱动即激活） |

### 高级能力

- **多智能体 DAG 编排**：`agent_team_run` 支持角色间 `dependsOn` 拓扑排序、同阶段并行、跨阶段串行、上游输出注入下游。
- **Hybrid 记忆检索**：纯 TypeScript BM25（中文 bigram 分词）+ 可插拔 embedding（本地 TF / OpenAI 兼容端点）向量召回，`alpha` 加权融合，未配 key 自动降级。
- **真实 PDF 导出**：基于 pdfkit 纯 JS 渲染（无 Chromium），支持中文子集嵌入、表格、代码块、Markdown 图片、`<!-- chart:bar|line -->` 矢量柱状图/折线图、页码页脚。
- **消息级操作**：消息导出为 Markdown 下载、用户消息编辑后 fork 重跑。
- **工程化体验**：代码块「新标签打开」、会话历史虚拟滚动（500+ 条仅渲染可视窗口）、移动端响应式（768px/480px 断点）、模型参数滑杆（temperature / maxTokens，localStorage 持久化）。

## 目录结构

```
omniagent/
├── packages/               # monorepo 工作区（320+ 内部包）
│   ├── boot/               # profile 启动、bundle/插件加载、PROFILE_TEMPLATES
│   ├── host/               # 宿主侧：webserver、frontend-static、目录选择、通知
│   ├── client/             # 浏览器侧 React UI：ui-* 各面板与槽位
│   ├── core/ llm/ session/ memory/ guard/ tools/ util/ ...
│   ├── finance/ ecommerce/ # 领域 Agent 插件（host 半边）
│   └── bundle/             # profile 组合包：base / web-app / headless / finance / ecommerce / general-full
├── apps/
│   ├── cli/                # oa / dsh 命令行入口（bin.ts）
│   ├── web/                # web 前端工程（vite）
│   └── desktop/ desktop-host/  # Electron 桌面壳
├── config/                 # overlay 示例（agnes-ai.patch.yml）
├── scripts/                # 构建、代码生成、约束检查、rebrand 等工程脚本
├── docs/                   # 架构、代码审计、markdown 安全、编辑器评估等文档
└── native/ python/ vendor/ # 原生模块 / Python SDK / 第三方 vendored 依赖
```

## 插件与生态

### 「万物皆可插件」

一个领域插件 = 一个 Agent 插件包（host 半边：数据契约 + 纯逻辑 + 工具 + 人设注入）+ 一个 profile 组合包（声明 `dsh.bundle.patch` 的 `cordis.patch.yml`，可选挂载 client 半边 UI 槽位）。工具只依赖数据契约，与具体数据源解耦；示例数据须带 `mock` 标记并向用户明示。

插件开发完整指南见 **[`docs/plugin-dev.md`](docs/plugin-dev.md)**；随包两个范例：`packages/finance/finance-agent/` 与 `packages/ecommerce/ecommerce-agent/`。

### 从哪里获得插件

1. **官方组合包**：随安装发布、默认关闭，Web「插件」页一键启用（`OPTIONAL_BUNDLES`）。
2. **外部安装**：`oa plugin --profile <p> add <spec>` 支持 npm 包 / Git URL / tarball / 本地路径。
3. **自己写**：按上述模式打包发布，任何人都能安装。

## 开发

```bash
pnpm run dev:web        # 源码改动即重建 client bundle 并热更新
pnpm run typecheck      # 全量类型检查（host → client）
pnpm run lint           # oxlint
make help               # Web / Desktop 相关 Make 目标
```

## 许可

[MIT](LICENSE)。第三方依赖及其许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
