# OmniAgent 架构总览

本文描述 OmniAgent 的整体架构：monorepo 组织、DSH（DeepSeek Harness）插件运行时、host/client 半边插件机制、profile 组合包系统、构建链与关键数据流。

## 1. Monorepo 结构

OmniAgent 是一个 pnpm workspace monorepo，共 **330+ 内部包**。根 `package.json` 的 `workspaces` 声明了四个目录面：

```
vendor/*                     # 第三方 vendored 依赖（ cordis / schemastery 等）
packages/*/*                 # 全部内部库（按领域分组，每组下一个或多个包）
native/system                # 原生系统模块
apps/*                       # 可执行应用：cli / web / desktop / desktop-host
```

`packages/` 按职责分组：

| 分组 | 职责 |
|---|---|
| `boot/` | profile 启动、bundle 加载、plugin-manager、HMR |
| `host/` | 宿主侧服务：webserver、frontend-static、目录选择、open-in-app |
| `client/` | 浏览器侧 React UI（`ui-*` 数十个面板）与槽位系统 |
| `core/ llm/ session/ context/` | Agent 主循环、LLM 协议、会话与上下文压缩 |
| `memory/ guard/` | 长期记忆/BM25+向量、权限规则 |
| `tools/` | 通用工具包（tool-git、tool-notify） |
| `finance/ ecommerce/` | 领域 Agent 插件（host 半边） |
| `bundle/` | profile 组合包（base / web-app / headless / finance / ecommerce / general-full …） |
| `util/` | 原子写、values、brand、home-paths 等纯工具 |

## 2. DSH 体系与插件运行时

DSH（DeepSeek Harness）是本仓库的底座运行时——一个基于 **Cordis** 的服务容器：

- **服务即插件**：每个能力（`llm`、`session`、`tools`、`systemPrompt`、`schedule`…）都是一个 Cordis 服务插件，按「服务可用性」驱动激活，与 patch 中的行序无关。
- **加载器**：`packages/boot/plugin-manager` 负责解析 bundle 依赖、建立 bundle 级 `node_modules` 链接、按 `cordis.patch.yml` 逐层注入插件行，并在 Web「插件」页做启用/停用。
- **Bundle 系统**：一个 bundle = 一个 npm 包 + 一份 `cordis.patch.yml`，在 `package.json` 里通过 `dsh.bundle.patch` 字段声明。patch 是对 profile 根配置的**增量补丁**（`- insert:` 追加一组插件行，或 `- id: <行>` 按 id 覆写该行整个 `config`）。多个 bundle 与用户自己的 `cordis.patch.yml`、`--patch` overlay 按层叠加，**同行后写覆盖前写（last write wins per row）**。

## 3. 插件机制：host 半 / client 半

一个能力插件常常横跨进程边界，分成两半：

- **host 半边**（Node 侧）：Cordis 插件包，注册模型可调用的 `defineTool`、监听工具执行事件、向 `systemPrompt` 注入段落。它必须用 `export const inject = [...]` **显式声明依赖的 Cordis 服务**，例如：
  ```ts
  export const inject = ['tools']                       // permission-rules
  export const inject = ['tools', 'systemPrompt']        // memory
  ```
  忘记声明 inject 而访问 `ctx.tools` / `ctx.systemPrompt` 会在运行时 import 失败——这是插件加载的常见坑。
- **client 半边**（浏览器侧）：一个 `@deepseek-ai/dsh-client-ui-*` React 包，不直接拼界面，而是**挂载到 host 侧暴露的槽位（slots）**上。槽位系统见 `packages/client/ui-slots`（`renderer.ts` / `store.ts`），例如金融面板 `ui-finance` 挂到会话区槽位，模型参数滑杆挂到 `settings.models.footer` 槽位。
- **Bundle purity**：host 包不得 import React，client 包不得访问 Node API；两半通过 host 暴露的浏览器名册（`window.__DSH_BOOT__`）与投影（projection）通信。领域 profile 才挂载对应 client 半边，通用 `web` profile 不挂载，故界面保持通用。

## 4. Profile 系统

Profile = 一组 bundle 的命名组合，首次使用时由 `PROFILE_TEMPLATES` 自动初始化（见 `packages/boot/app-boot/src/profile.ts`）：

| Profile | Bundles | 用途 |
|---|---|---|
| `web` | base + general-full + web-app | 通用 Web 对话界面 |
| `headless` | base + general-full + headless | 一次性命令行任务 |
| `acp` / `sdk` / `sdk-minimal` | base(+acp-app/sdk-app/sdk-minimal) | ACP / SDK 嵌入 |
| `finance` | base + general-full + **finance** + web-app | Web 界面瞬变为金融终端 |
| `ecommerce` | base + ecommerce + web-app | 电商运营助手 |

**`OPTIONAL_BUNDLES`** 是随安装发布、默认关闭的组合包（finance / ecommerce / general-full / 两个 experimental 包），不被任何 template 默认完整挂载，而是在 Web 侧栏「插件」页提供开关。启用一个 optional bundle = 往当前 profile 注入它的 `cordis.patch.yml`。领域 bundle 同时自带默认模型路由（如 finance 内置 `deepseek-openai` provider，配好 `DEEPSEEK_API_KEY` 即可对话）。

## 5. 构建链

分面（face）构建，host 与 client 分开：

```
tsc -b tsconfig.host.json   →  类型检查 + 项目引用图（project references）
tsdown --env.DSH_BUILD_FACE host    →  打包 host 库（ESM）
tsc -b tsconfig.client.json
tsdown --env.DSH_BUILD_FACE client  →  打包 client 库
pnpm --filter @deepseek-ai/dsh-web-frontend run build   →  vite 构建 web 前端产物
```

- `tsconfig.host.json` / `tsconfig.client.json` 是两个项目引用面；`tsconfig.base.json` / `tsconfig.base.client.json` 为公共配置。
- `scripts/build.ts` 编排整体构建；`gen-tsconfig-paths` / `gen-client-catalog` / `gen-scoped-events` 等代码生成脚本维护跨包索引，并有 `--check` 模式做 CI 校验。
- `dev:web` 在一个终端里同时构建、起服务、监听源码改动重建 client bundle。

## 6. 前后端分层

```
┌────────────────────────── Browser (client) ──────────────────────────┐
│  React UI：ui-chat / ui-conversation / ui-status-bar / ui-command-     │
│  palette / ui-session-history / ui-plugin-market / ui-finance / …     │
│  槽位 slots：各面板挂到具名槽位，组合成完整界面                          │
└───────────────▲───────────────────────────────────────────┬──────────┘
                │ 投影 (projection)：host→client 的只读视图   │ 命令/事件
┌───────────────┴───────────────────────────────────────────▼──────────┐
│  Node (host)：Cordis 服务容器                                          │
│  · llm / llm-pi-ai（多 provider 路由）                                 │
│  · session / session-log / session-title                              │
│  · tools（工具注册 + pre/post 执行钩子）                                │
│  · memory / permission-rules / schedule / jobs / subagent(agent-team) │
│  · host/webserver 静态托管 + WebSocket 传输                            │
└────────────────────────────────────────────────────────────────────────┘
```

- **host**：Cordis 服务、工具注册、模型路由、会话持久化、权限拦截、后台任务。
- **client**：纯展示 React，通过 host 投影订阅状态，不直接持有业务逻辑；任何写操作经事件/命令发回 host。

## 7. 关键数据流

**一次对话：**

1. client 发送用户消息 → host `session` 服务落盘（JSONL 会话日志），触发 `session-title` 生成标题。
2. Agent 主循环（`core/agent-loop`）拼装 system prompt（含 memory 注入段、workspace 信息）→ 调 `llm` 服务路由到选定 provider。
3. 模型返回工具调用 → host `tools` 分发：先经 `permission-rules` 按 allow/auto/ask/deny 规则判定（deny 直接拦截，ask 弹审批）→ 执行工具 → 结果回灌模型。
4. 流式增量经 WebSocket 推回 client，client 经**投影（projection）**订阅会话面（如 `tokenUsage`、消息列表）渲染；切换主会话时按 `sessions.binding(id)` 重新绑定投影。

**插件装载：** 启用 optional bundle → plugin-manager 注入 patch 行 → Cordis 按服务可用性激活 host 插件（注册工具/注入 prompt），并把对应 client 包注册进浏览器名册 → client 启动时扫描 `window.__DSH_BOOT__` 挂载槽位面板。finance profile 启动时 `ui-finance` 自动选中，中心对话区即变为金融终端。
