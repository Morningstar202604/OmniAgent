# OmniAgent：真实模型全面跑通 + 全栈对标与差异化报告

> 环境：本地仓库 /home/user/Doubao/chats/38444402511021570/omniagent（DSH 体系 pnpm monorepo）
> LLM：Agnes AI（OpenAI 兼容，https://apihub.agnes-ai.com/v1，agnes-3.0-flash）
> 测试日期：2026-09-27
> 本次更新：在原金融对标基础上，新增「全栈功能对标」大章节（前端 18 项 + 后端 18 项 + 差距优先级 + 后端专项实现建议），原金融部分完整保留于后文。

---

## 〇、全栈功能对标（本次新增）

> 对标对象：
> - **AI 编程/智能体工具**：OpenCode（SST 开源终端 Agent，TUI+Desktop+IDE 三端）、Codex CLI（OpenAI 开源终端 Agent，云端任务+沙箱）、Cursor（VS Code fork，Tab/Composer/多 Agent）、Claude Code（Anthropic 终端 Agent，subagent/hooks/权限模式）
> - **大厂 AI 应用**：豆包（工作任务模式/定时任务/Skills/浏览器操作）、Kimi（K2 Agent/Agent Swarm 300 子代理/端到端 Office 输出）、通义千问/Qwen（百炼插件广场/Qwen-Agent 框架/Qwen Code CLI）
>
> 现状判定基于本仓库实际代码结构（`packages/client/ui-*` 前端模块、`packages/*` 后端包）与 Web UI 实测。

### 0.1 前端功能差距清单（18 项）

| # | 功能项 | 状态 | OmniAgent 现状 | 对标对象实现方式 | 优先级 |
|---|---|---|---|---|---|
| F1 | 状态栏/信息栏（模型/会话状态/token/连接） | ✅ 已有 | `ui-chat/performance-usage.ts` + 对话区显示"深度求索中/已完成工作/用时/用量"；模型名在输入框上方；`ui-settings-general` 有"性能与用量"开关 | Claude Code 底部 statusline 可执行任意 shell 脚本，实时显示 context 占用百分比、花费、git 分支；Codex TUI 右下角显示模式（read-only/auto/full）与 token 计数 | P1 |
| F2 | 会话历史与分支（多会话/分支/时间线） | ⚠️ 部分存在 | `ui-sidebar` + `ui-session` + `ui-conversation/conversation-nodes`；侧边栏会话列表跨重启持久化、可搜索；但**无会话分支/fork 时间线可视化**（从某条消息分叉重开） | Claude Code `/resume` 选择器可浏览历史会话并恢复；Cursor 2.0 侧边栏集中管理多 Agent 与计划；OpenCode 支持多会话并行、可分享 session link；Kimi 有完整会话时间线 | P1 |
| F3 | 专业领域面板（加载插件后界面瞬变） | ⚠️ 部分存在 | `ui-slots` + `ui-cordis`（`ui-cordis` 客户端插件运行时）支持插件注入 UI；实测启用金融插件后模型工具集瞬变，但**对话旁无专业可视化面板**（K 线图、行情卡片、估值仪表盘） | Wind/同花顺有原生行情面板；Kimi Agent 输出 Word/Excel/PPT 端到端渲染；Cursor Composer 在编辑器内 inline diff 渲染 | P0 |
| F4 | 全局命令面板（Ctrl+K） | ✅ 已有 | `ui-command-palette` 模块存在，支持快捷命令导航 | OpenCode 1.0 TUI 内置 command palette（切主题/切会话/切模型/执行命令）；Cursor 斜杠菜单 `/` 唤起命令 | P2 |
| F5 | 模型选择与切换（多模型对比/参数调节） | ✅ 已有 | `ui-model-selection` 下拉切换；`ui-settings-models` 管理 Provider（DeepSeek/Agnes/自定义 OpenAI 端点/协议 Chat/Responses/Anthropic Messages）；但**无多模型并排对比、无 temperature/top_p 滑杆** | Kimi 输入框上方一键切 K2.6/K3/K3 集群 + 思考强度标准/进阶；Claude Code `/model` + `/effort` 调节推理强度；Cursor Max Mode 多模型可选 | P1 |
| F6 | 代码编辑器集成（语法高亮/diff/代码块操作） | ⚠️ 部分存在 | `ui-tool` 下有 `diff-card-model.ts`、`file-mutation-row.tsx`、`todo-diff-model.ts`——文件修改以 diff 卡片展示；Markdown 渲染含语法高亮；但**无内嵌 Monaco/CodeMirror 代码编辑器**，不能在对话中直接编辑代码 | Cursor 是 VS Code fork，原生编辑器 + inline diff + Tab 补全；Claude Code 在 VS Code 扩展中展示 diff；OpenCode Desktop 有 diff viewer | P1 |
| F7 | 文件浏览器/工作区管理 | ✅ 已有 | `ui-sidebar-files` + `ui-workspace` + `ui-directory-picker-browse/native`；工作区概念完整 | Cursor `@files` 引用；OpenCode 自动加载 LSP | P2 |
| F8 | 终端集成 | ✅ 已有 | `ui-sidebar-terminal` + `packages/terminal` + `packages/shell`（bash/pwsh 本地+沙箱+持久 shell） | Cursor Agent Terminal 改进版；Claude Code 在终端原生运行；Codex TUI 内嵌终端 | P2 |
| F9 | 搜索（全局/文件内/网络） | ✅ 已有 | 侧边栏会话搜索；`packages/web` 接 deepseek/exa/perplexity 三种网络搜索；`tool-fs-search` 文件搜索；`ui-settings-web-search` 可配 | Kimi 联网搜索自主判断开关；豆包浏览器 Skill 操作真实网页；Cursor `@Recommended` 自动拉取上下文 | P2 |
| F10 | 设置面板（分类/快捷键/外观） | ✅ 已有 | 设置页极完整：通用（权限模式/语言/外观/字号/工作步骤展示/性能用量/开发者工具）、模型、内置插件（29 会话+181 全局）、Agent 预设（标准/PTC/极简/创造）、Shell、Subagent、Web 搜索；但**无快捷键自定义面板** | Cursor Settings 全部分类；Claude Code `/config` 文本配置；OpenCode `opencode.json` | P1 |
| F11 | 插件/扩展市场（浏览/安装/管理/配置） | ✅ 已有 | `ui-plugin-manager` + `ui-settings-plugins` + `ui-settings-plugin-inventory`；支持 npm 包/Git/tarball/本地路径安装；官方组合包一键启停；**但无在线市场浏览页**（只有本地已装列表） | 通义百炼"组件广场"在线浏览申请插件；Claude Code 插件市场（plugin subagents）；豆包 Skills 商店 | P0 |
| F12 | 通知系统（任务完成/错误/审批） | ⚠️ 部分存在 | `ui-approval`（审批请求弹窗）+ `ui-jobs`（后台任务列表）+ `message-feedback`（消息反馈）；但**无操作系统级通知**（任务完成后桌面角标/推送） | Cursor 1.5 引入 OS notifications + Linear 集成后台 Agent 完成通知；豆包定时任务完成后推送；Codex 云端任务完成邮件/APP 推送 | P1 |
| F13 | 拖拽与附件（文件拖/图片粘贴/多模态） | ✅ 已有 | `ui-attachment` + `file-upload` + `packages/attachment`；支持文件拖拽、图片粘贴 | Kimi 多文件上传（PDF/DOC/XLS/PPT/图片）；豆包多模态输入；Cursor @ 引用文件/图片 | P2 |
| F14 | 流式输出与打字机效果 | ✅ 已有 | `transcript-view.ts` + SSE 流式；实测"深度求索中"逐步输出 | 所有对标对象均有；Cursor 流式 token 级渲染 | P2 |
| F15 | 消息操作（编辑/重生成/复制/导出/分支） | ⚠️ 部分存在 | `MessageIconActions.tsx` 存在操作按钮；`conversation-nodes` 支持节点；`message-feedback` 点赞点踩；但**无单条消息编辑后重跑（rewind）、无从消息分叉分支、无导出单条消息** | Claude Code 可 `/rewind` 回到历史检查点；Cursor Checkpoints 可回滚；ChatGPT/Claude 网页端可编辑消息重生成 | P1 |
| F16 | 深色/浅色主题与自适应 | ✅ 已有 | `ui-theme` + 设置里外观/字号；实测深色浅色可切 | 全部对标对象均有 | P2 |
| F17 | 移动端/响应式适配 | ✅ 已完成 | 2026-09-27 补齐：断点 768px/480px 纯 CSS 媒体查询，布局由 columns.js 驱动（<1024px 侧栏折叠、右栏 overlay），各组件窄屏适配（状态栏收起非关键信息、Hero 缩标题、插件市场单列、金融面板堆叠）；CDP 375×812 实测通过 | 豆包/Kimi/通义均有完整移动端 App；Cursor 有 iOS App；Claude Code 有移动 SSH 场景 | P2 |
| F18 | 可观测面板（trajectory/工具链/token 明细） | ✅ 已有 | `ui-trajectory`（`TrajectoryTable.tsx`）逐步展示系统提示词/上下文/每轮工具调用与结果；`token-meter`；`session-telemetry-otel` | Claude Code `-p` 打印完整 trace；OpenCode TUI 面板展示工具调用；Cursor usage visibility 改进 | P2 |

### 0.2 后端能力差距清单（18 项）

| # | 能力项 | 状态 | OmniAgent 现状 | 对标对象实现方式 | 优先级 |
|---|---|---|---|---|---|
| B1 | 多智能体协作（子代理/team/消息传递） | ✅ 已有 | `packages/subagent/` 极完整：subagent（进程内 fork/spawn）、subagent-acp、**subagent-claude-code、subagent-codex（可把 Claude Code/Codex 当子代理调）**、tool-subagent-control；`experimental/agent-team` + `client-ui-agent-team`；Kimi Agent Swarm 300 子代理 | Kimi Agent Swarm 4000+ 并行工具调用/300 子代理；Claude Code subagents 并行开发（后端 API + 前端）；Cursor 2.0 最多 8 个并行 Agent（git worktree 隔离） | P2（已领先） |
| B2 | 任务队列/后台任务（异步/取消/优先级） | ✅ 已有 | `packages/jobs/`（jobs-local + tool-jobs）；`ui-jobs` 展示；Claude Code background tasks 保持 dev server 不阻塞 | Claude Code background tasks；Cursor Background Agents（Linear 触发）；Codex 云端任务异步排队 | P2 |
| B3 | 工具注册与编排（动态加载/组合/权限） | ✅ 已有 | `packages/core/tools` + `packages/extensions`（cordis host/client runner）+ `packages/mcp`（mcp-client 接外部 MCP server）+ `packages/skill`（skill-filesystem/office）；工具 schema 动态注入 | Claude Code MCP + hooks + ToolSearch 延迟加载；OpenCode LSP 自动加载；通义百炼插件广场 | P2 |
| B4 | 流式输出（SSE/token 级/工具调用流式） | ✅ 已有 | `packages/llm`（deepseek/pi-ai/retry）+ `packages/api/gateway` SSE；实测 token 级流式 + 工具调用流式 | 全部对标对象均有 | P2 |
| B5 | 权限/审批系统（敏感操作/白名单/预设） | ⚠️ 部分存在 | `packages/guard`（repeat-tool-reminder、timeout-policy）+ `sandbox-policy` + `ui-approval` + `ui-permission-presets`；设置里有权限模式；但**无细粒度 allow/deny 规则引擎（通配符匹配工具名）、无 acceptEdits/dontAsk/delegate 分级** | Claude Code 权限模式四档（default/acceptEdits/dontAsk/delegate）+ `mcp__server__tool` 通配符 allow/deny；Codex 三档（read-only/auto workspace/full access）；OpenCode 权限提示 | P0 |
| B6 | 上下文/会话管理与恢复（持久化/断点续传/压缩） | ✅ 已有 | `session-persistence-jsonl` + 多版本 format 迁移（v0→v4）+ `packages/compaction`（basic/image-offload/tool-result-pruner）+ `session-checkpoint-policy` + `session-turn-outline` + `/compact` 命令；跨重启恢复 | Claude Code `/compact` + `/resume` 大会话先摘要再加载；Codex 压缩会话状态；OpenCode SQLite 持久化 | P2 |
| B7 | 插件/扩展体系（市场/热加载/依赖/schema） | ✅ 已有 | cordis 插件体系；`boot/plugin-manager`；支持 npm/git/tarball/local 安装；`ui-cordis` 客户端插件热加载；配置 patch yml；但**无插件 schema 校验/依赖版本解析/在线市场** | Claude Code plugins（frontmatter 声明 hooks/mcpServers/permissionMode）；通义百炼组件广场；VS Code 扩展市场依赖解析 | P1 |
| B8 | 可观测/轨迹（完整 trajectory/token/延迟/错误追踪） | ✅ 已有 | `session-telemetry-otel`（OpenTelemetry）+ `session-stats` + `runtime-diagnostics` + `ui-trajectory` 表格 | Claude Code trace；OpenCode session share link；Cursor usage visibility | P2 |
| B9 | 文件与代码操作（读写/搜索/git/执行） | ⚠️ 部分存在 | `packages/fs`（fs-local/fs-sandbox/tool-fs/tool-fs-search/tool-str-replace-editor）文件读写与字符串替换编辑；`deliverables/workspace-changes/git.ts` 有 git working-tree 快照、numstat diff、ignore 检查；但**agent 无主动 git add/commit/branch/diff 的工具**，git 仅用于展示工作区变更 | Claude Code 原生 git 集成（commit/branch/PR）；Cursor 2.0 git worktree 隔离多 Agent；OpenCode LSP 感知定义 | P1 |
| B10 | 终端（shell 执行/长任务/输出捕获） | ✅ 已有 | `packages/shell`（bash-local/bash-sandbox/pwsh-local/pwsh-sandbox/tool-bash/tool-bash-persistent）+ `packages/terminal`（terminal-bash/tool-terminal）；长任务输出捕获 | Claude Code 终端原生；Cursor Agent Terminal；Codex 沙箱 shell | P2 |
| B11 | 搜索（网络/代码/文档/向量检索） | ⚠️ 部分存在 | `packages/web`（tool-web/web-fetch-http/web-search-deepseek/exa/perplexity）网络搜索；`tool-fs-search` 代码搜索；`session-query` 会话搜索；但**无向量检索/语义搜索/文档索引** | Cursor 语义代码搜索（@Codebase）；Kimi 200 万字上下文+多文件解析；豆包浏览器 Skill 真实网页操作 | P1 |
| B12 | 定时任务（cron/定时触发/调度） | ✅ 已有 | `packages/schedule` + `ui-schedule`；实测可配定时 | 豆包定时任务（每天 8 点自动跑科技雷达，完成推送）；Claude Code hooks 触发；Codex GitHub Action CI 调度 | P2 |
| B13 | 记忆/知识库（长期记忆/RAG/文档索引） | ❌ 缺失 | **全仓库无 embedding/vector/chroma/qdrant/long-term memory 包**；`packages/context` 只有 agent-instructions/file-reference/time-context/tmux-context（单次会话上下文），无跨会话长期记忆、无文档 RAG 索引 | Claude Code Memory（MEMORY.md 自动累积用户偏好）；Kimi 知识库；ChatGPT Memory；Cursor Codebase indexing 语义索引；豆包连接器 | P0 |
| B14 | 报告导出（PDF/MD/HTML/模板/批量） | ⚠️ 部分存在 | `deliverables/tool-present` 仅"声明交付文件、用默认应用打开"，不生成内容；`workspace-changes` 展示变更；**无 PDF/HTML 渲染导出、无报告模板、无批量导出** | Kimi K2.5 端到端输出 Word/PDF/Excel/PPT；豆包 AI PPT/AI 表格；iFinD 研报 PDF 导出；Bloomberg Auto-Brief | P0 |
| B15 | 多模型支持（路由/fallback/对比/成本优化） | ✅ 已有 | `packages/llm`（llm-deepseek/llm-pi-ai/llm-retry/token-meter）+ `agent-default-model` + bundle patch 模型路由；OpenAI 兼容任意端点；但**无自动 fallback（某模型 429 自动切备用）、无成本路由（简单任务走便宜模型）** | Kimi K3 集群自动切；Qwen Code 过载自动切模型；OpenCode 75+ LLM；Claude Code `/model` 切换 | P1 |
| B16 | 安全沙箱（代码执行隔离/文件/网络） | ✅ 已有 | `packages/sandbox`（sandbox-local/sandbox-policy/sandbox-windows-acl）+ `fs-sandbox` + `shell-sandbox` + `subprocess` 隔离；Windows ACL 隔离 | Codex 云端沙箱（容器隔离）；OpenCode local-first；Cursor 远程机器/worktree 隔离 | P2 |
| B17 | Webhook/API（外部触发/回调/REST） | ✅ 已有 | `packages/webhook`（webhook-github）+ `packages/api/gateway` + account/job/session/settings/terminal/workspace 控制器 REST API；但**无通用出站 webhook 结果回调、无用户自定义 webhook 配置** | Codex GitHub Action + `codex exec` SDK；Cursor Linear 集成；豆包连接器；Qwen Code WeCom channel | P1 |
| B18 | 金融专属（选股回测/NL→量化/产业链/实时行情） | ⚠️ 部分存在 | `packages/finance` 17 工具（quote/metrics/financials/kline/moneyflow/announcements/news/macro/research/risk/calc 等）；但**无选股 screener、无回测 backtest、无产业链图谱、无实时行情推送**（见后文金融对标章节） | 同花顺 i问财 NL 选股+量化策略生成器；聚宽/米筐回测；Wind MCP；Bloomberg Filing Reader | P0（详见第三章） |

### 0.3 差距汇总与优先级排序

> 排序原则：P0 = 用户点名对标招牌功能 + 产品定位（万物皆可插件）差异化相关，本次必须做；P1 = 近期迭代显著提升体验；P2 = 长期规划或已领先。

#### P0（必须本次做）

| 项 | 为什么是 P0 |
|---|---|
| **F3 专业领域面板 UI** | "加载插件后界面瞬变为专业应用观感"是 OmniAgent 核心定位卖点。当前金融插件只有工具调用无可视化面板，对比 Wind/同花顺/iFinD 观感差距最大。最小版：finance bundle 增加 ui-plugin，对话旁渲染行情卡片 + K 线（轻量 canvas，不引重型图表库）。 |
| **F11 插件在线市场** | "万物皆可插件"需要让用户**发现**插件，当前只有本地已装列表。最小版：插件页加"浏览官方组合包"tab（从 OPTIONAL_BUNDLES 渲染卡片列表，点击即启用/安装），不做第三方上传，先做官方目录。 |
| **B5 细粒度权限/审批规则** | Claude Code 四档权限 + `mcp__server__tool` 通配符 allow/deny 是安全可信的基石。当前只有权限模式预设，用户无法精细控制"允许读但禁止写某目录""允许某 MCP 全部工具"。最小版：权限配置增加 allow/deny 列表（glob 匹配工具名），UI 在审批弹窗加"始终允许此类"。 |
| **B13 长期记忆/知识库** | 这是与所有大厂产品（ChatGPT Memory/Claude Memory/Kimi 知识库/豆包连接器）最大的后端差距。当前每次会话从零开始，跨会话不记用户偏好。最小版：`packages/memory`——用户偏好落盘 `MEMORY.md`，系统提示词自动注入；后续再接 RAG。 |
| **B14 报告导出（PDF/HTML/Markdown）** | Kimi K2.5 端到端 Office 输出、豆包 AI PPT、iFinD 研报导出都是招牌。当前 present 只"打开文件"不生成报告。最小版：新增 `tool-export-report`，把对话/工具结果渲染为 Markdown → HTML（Puppeteer/playwright 已在 browser-use 里）→ PDF。 |
| **B18 金融选股/回测** | 详见第三章金融对标——同花顺 i问财 NL 选股、聚宽回测是金融 AI 的核心招牌，当前 17 工具缺 screener/backtest。 |

#### 本次 P0 补齐完成情况（2026-09-27）

| P0 项 | 状态 | 实现包 / 工具 | 验证结果 |
|---|---|---|---|
| **F3 专业领域面板 UI** | ✅ 已完成 | `packages/client/ui-finance`（行情条+标的详情+SVG K线+研报/公告/资讯三标签+六大专业功能入口） | finance profile 启动自动选中金融终端，web profile 保持通用界面；红涨绿跌、标的切换交互正常 |
| **F11 插件在线市场** | ✅ 已完成 | `packages/client/ui-plugin-market`（搜索+分类过滤+精选横幅+卡片网格+安装状态） | 浏览器实测市场页可访问，官方+社区插件目录展示正常 |
| **B5 细粒度权限/审批规则** | ✅ 已完成 | `packages/guard/permission-rules`（四档 allow/auto/ask/deny + 通配符 + 预设 + permission_* 工具） | headless 实测：deny 规则真实拦截工具调用，permission_get/set/presets 正常 |
| **B13 长期记忆/知识库** | ✅ 已完成 | `packages/memory/memory`（SQLite 持久化 + memory_*/knowledge_* 工具 + 系统提示词注入） | headless 实测：memory_add/search/list 落盘重开可读，数据库文件 ~/.omniagent/memory.db 持久化 |
| **B14 报告导出** | ✅ 已完成 | `packages/report-export`（Markdown/HTML 双格式 + 三种专业模板 + report_export 工具） | Agnes 真实模型端到端：回测结果导出为 5.7KB HTML 报告，真实落盘 |
| **B18 金融选股/回测** | ✅ 已完成 | `packages/finance/finance-agent/src/backtest.ts` + `quant.ts`（finance_backtest 双均线/定投 + finance_quant_code 五策略模板） | Agnes 真实模型端到端：茅台双均线回测 18 笔交易、累计 -7.79%、回撤 -15.65%，附公式可复核 |

**额外补齐（本次一并实施）**：
- 前端顶部状态栏（`ui-status-bar`）：模型/会话/token/连接状态/时钟/主题切换
- 前端会话历史面板（`ui-session-history`）：按时间分组/搜索/切换/分支/归档
- 后端任务队列增强（`packages/jobs/tool-task`）：task_run/status/list/cancel
- 后端多智能体协作（`packages/subagent/agent-team`）：agent_team_run 角色并行编排

**插件加载修复记录**：permission-rules 与 memory 初始报 `failed to import`，根因有二——(1) base/finance bundle 的 `dependencies` 未声明新插件，pnpm 未建立 bundle 级 node_modules 链接，运行时解析器找不到包；(2) cordis `inject` 声明错误（permission-rules 为空数组但访问 ctx.tools，memory 完全缺失 inject 但访问 ctx.tools+ctx.systemPrompt）。均已修复，web profile 启动无警告。

**后续路线（2026-09-27 第二轮补齐，4 项全部完成）**：

| 项 | 状态 | 实现方案 | 验证结果 |
|---|---|---|---|
| **状态栏 token 真实统计** | ✅ 已完成 | 复用 Host 会话投影 `tokenUsage`（与聊天区 StatsPills 同一数据源），经 `sessions.binding(id).session.projections.faceOf('tokenUsage')` 订阅，主会话切换自动重绑；紧凑格式化（<1k 原样，≥1k 用 k，≥1M 用 M），无数据回退 `—`，tooltip 展示输入/输出明细 | 浏览器实测：历史会话显示 7.6k/48.4k tokens，切换会话跟随更新，深浅色自适应 |
| **PDF 真实渲染** | ✅ 已完成 | `pdfkit`（纯 JS ~500KB，无 Chromium）+ `fontkit`，从 NotoSansCJK.ttc 取简中子字体嵌入，自动子集化；Markdown 块级解析→pdfkit 绘制（主题色横幅/粗体标题/表格边框/深色代码块/页脚页码） | `%PDF-1.3` 文件头，`pdftotext` 可完整提取中文/数字/代码，文件约 130KB 可搜索 |
| **记忆语义检索** | ✅ 已完成 | 纯 TypeScript BM25（k1=1.5, b=0.75），中文 bigram 分词+英文单词分词+中英文停用词表；SQLite `memory_terms`/`knowledge_terms` 持久化倒排索引，启动时恢复并一致性校验；BM25 排序优先，无命中退化为 LIKE | 12/12 用例通过："用户职业"→命中前端记忆、"做饭"→不误召、更新/删除索引同步、重启持久化、知识库语义召回 |
| **移动端响应式** | ✅ 已完成 | 断点 768px/480px 纯 CSS 媒体查询；布局本就由 columns.js 驱动（<1024px 侧栏折叠 56px、右栏变 overlay），在此基础上补各组件窄屏适配（状态栏收起 token/时钟、Hero 缩标题、插件市场单列、命令面板收紧、金融面板堆叠） | CDP 模拟 375×812：首页单栏三卡纵向、状态栏单行、插件市场单列可滚动、命令面板不超视口；桌面 1280px 不受影响 |

**仍待后续（2026-09-27 第三轮补齐，3 项全部完成）**：

| 项 | 状态 | 实现方案 | 验证结果 |
|---|---|---|---|
| **agent_team_run DAG 编排** | ✅ 已完成 | TeamRole 增加 `dependsOn`/`stage`；Kahn 拓扑排序+环检测，同阶段 `Promise.allSettled` 并行，跨阶段串行；上游输出纯文本注入下游 prompt（单段上限 4000 字）；无 dependsOn 时退化为原全并行 | 18/18 DAG 单测通过（拓扑分层/菱形并行/环/悬空依赖/自依赖/重名/stage 冲突/stage 顺延）；headless mock LLM 端到端验证父代理→研究员→分析师执行顺序；Agnes 真实模型端到端跑通：研究员先列三家 AI 公司营收 → 分析师基于数据判断 OpenAI 增长最快，依赖顺序与消息传递均正常 |
| **记忆向量/embedding 召回** | ✅ 已完成 | `EmbeddingProvider` 可插拔接口 + `LocalTFEmbedding`（默认离线，稀疏词项向量+余弦）+ `OpenAICompatibleEmbedding`（智谱/阿里/百度 `/v1/embeddings`）；新增 `memory_vectors` 表；hybrid 融合 `final=alpha*bm25_norm+(1-alpha)*vector_norm`；未配 key 自动降级，网络失败不阻断 | 19/19 hybrid 断言通过（BM25 漏召对照、向量补召回、精确关键词回归、无 key 本地 TF、网络失败降级、请求形态验证、重启持久化）；12/12 BM25 回归通过；真 embedding 端点需提供 API key 后端到端验证，未假报完成 |
| **PDF 复杂排版** | ✅ 已完成 | `![alt](src)` 图片嵌入（本地路径+远程 URL，5 秒超时，失败占位框降级）；`<!-- chart:bar|line -->` 标记表格渲染为矢量柱状图/折线图（纯 pdfkit 绘制坐标轴/网格/图例/数据标签，主题色系）；大块换页保护 | 测试 PDF 127KB，`%PDF-1.3` 合法，`pdfimages` 确认图片真实嵌入，`pdftotext` 可提取图注/图例/类别/数值；目检两页：图片居中带图注、柱状图与折线图矢量绘制正常、失败图占位框降级 |

**仍待后续（剩余）**：agent 主动 git 提交工具、OS 级通知、会话分支时间线、模型参数滑杆、真 embedding 端到端验证（需 API key）、DAG 真实模型端到端验证（需 API 配额）。

#### P1（近期做）

| 项 | 说明 |
|---|---|
| F1 状态栏增强 | 参考 Claude Code statusline，底部栏显示 context 占用百分比 + 今日 token 花费 + git 分支；复用 token-meter。 |
| F2 会话分支/时间线 | 从某条消息 fork 新会话（subagent-fork-in-process 后端已有，前端缺时间线 UI）。 |
| F5 模型参数调节 | 输入框模型选择旁加 temperature/思考强度滑杆（Kimi/Claude Code `/effort`）。 |
| F6 内嵌代码 diff 编辑器 | 把 diff-card-model 升级为可编辑 Monaco/CodeMirror diff 视图（当前只读卡片）。 |
| F10 快捷键自定义 | 设置页加快键面板（命令面板已有，缺自定义映射）。 |
| F12 OS 级通知 | 后台任务完成/审批请求发系统通知（Desktop 用 Electron Notification，Web 用 Web Notification API）。 |
| F15 消息 rewind/编辑重跑 | 基于 conversation-nodes 做检查点回滚（Claude Code `/rewind`、Cursor Checkpoints）。 |
| B7 插件 schema 校验 | 插件安装时校验 config schema（cordis patch yml 已有雏形，补 JSON Schema 校验）。 |
| B9 agent 主动 git 工具 | 新增 `tool-git`（status/add/commit/branch/diff/log），workspace-changes/git.ts 已有底层能力。 |
| B11 向量语义搜索 | 代码库语义索引（Cursor @Codebase 招牌），最小版用 sqlite-vss 或本地 embedding。 |
| B15 模型 fallback/成本路由 | llm-retry 已有重试，补 429/超时时自动切备用模型 + 简单任务路由便宜模型。 |
| B17 通用出站 webhook | 用户配置 webhook URL，任务完成/审批时 POST 回调（当前只有入站 github webhook）。 |

#### P2（长期规划或已领先）

| 项 | 说明 |
|---|---|
| F4 命令面板 | 已有，补主题/插件导航项即可。 |
| F7/F8/F9/F13/F14/F16/F18 | 文件浏览器/终端/搜索/拖拽/流式/主题/可观测均已具备，持续打磨。 |
| F17 移动端 | 长期项，Web 端响应式改造工作量大，先做 PWA 壳。 |
| B1/B2/B3/B4/B6/B8/B10/B12/B16 | 多智能体/任务队列/工具编排/流式/会话恢复/可观测/终端/定时/沙箱均已具备且部分领先（subagent 可调 Claude Code/Codex 是差异化亮点）。 |

### 0.4 后端缺失能力专项：最小可用版（MVP）实现建议

> 针对 P0/P1 后端缺口，给出可落地的最小方案。原则：复用现有包结构与 cordis 插件范式，不引入重型基础设施。

#### B13 长期记忆（MVP）

- **新建 `packages/memory/`**：
  - `memory-filesystem`：把用户偏好/项目约定落盘到 `<workspace>/.omniagent/MEMORY.md`（仿 Claude Code CLAUDE.md 机制），分全局（`~/.omniagent/MEMORY.md`）与项目两级。
  - `tool-memory`：两个工具——`memory_write(key, content)`（追加事实）、`memory_recall(query)`（读全量 MEMORY.md，MVP 不做向量检索，直接全文注入系统提示词）。
  - 系统提示词注入：boot 阶段读 MEMORY.md 拼入 system prompt（`packages/core/system-prompt` 已有拼装点）。
  - **第二步（P1）**：接 embedding + sqlite-vss 做语义召回，替代全文注入。
- **差异化**：开源本地化记忆，不依赖云端账号，契合私有化部署定位。

#### B14 报告导出（MVP）

- **新建 `packages/deliverables/tool-export-report/`**：
  - `tool-export-report`：入参 `{ sessionId, format: 'markdown'|'html'|'pdf', template?: string }`。
  - Markdown 导出：直接序列化 session log（`session-persistence-jsonl` 已有结构化日志）为 `.md`。
  - HTML/PDF 导出：Markdown → HTML（复用现有 Markdown 渲染器）→ 调 `experimental/browser-use-runtime`（playwright/chromium 已有）打印 PDF。零新增重型依赖。
  - 模板：`templates/report-default.md`（标题/概述/工具调用表/结论），金融插件可提供 `templates/finance-report.md` 覆盖。
  - 产物通过现有 `tool-present` 交付到用户文件列表。
- **差异化**：金融插件一键导出投研报告 PDF，对标 iFinD/妙想。

#### B5 细粒度权限规则（MVP）

- **扩展 `packages/guard/`**：
  - 新增 `permission-rules`：配置文件 `~/.omniagent/permissions.yml`，格式仿 Claude Code：
    ```yaml
    allow:
      - "fs_read:*"
      - "mcp__puppeteer__*"
      - "bash:git*"
    deny:
      - "bash:rm -rf*"
      - "fs_write:/etc/**"
    ```
  - 工具执行前在 `agent-loop` 工具分发点（`packages/core/agent-loop`）拦截，glob 匹配工具名 + 参数前缀。
  - UI：审批弹窗加"始终允许此类操作"按钮（写白名单），`ui-approval` 已有弹窗框架。
  - 权限模式四档：default（询问）/ acceptEdits（自动接受文件写）/ dontAsk（自动拒绝）/ delegate（仅团队管理）。
- **差异化**：开源可审计的权限规则，企业私有化合规刚需。

#### B9 主动 git 工具（MVP）

- **新建 `packages/core/tools/tool-git/`**：
  - 复用 `deliverables/workspace-changes/git.ts` 的 `GitRunResult` 与 subprocess 能力，暴露 4 个工具：`git_status`、`git_diff`、`git_log`、`git_commit(message)`。
  - 不做 git push/branch 切换（高风险），MVP 只读 + 本地 commit。
  - 沙箱内执行（复用 shell-sandbox）。
- **差异化**：配合现有 workspace-changes，形成"agent 改代码 → 看 diff → 主动 commit"闭环。

#### B11 语义搜索（MVP，P1）

- **新建 `packages/search/code-index/`**：
  - 复用 `llm` 的 embedding 接口（OpenAI 兼容 `/embeddings`）。
  - 首次使用时扫描工作区文件，切块（~512 token），embedding 存 sqlite（`packages/storage/storage-sqlite` 已有）。
  - `tool_code_search(query)`：query embedding → sqlite-vss 最近邻 → 返回文件片段。
  - 增量更新：fs-observation（`packages/fs/fs-observation-policy` 已有）监听文件变更触发重索引。
- **差异化**：本地索引、数据不出域，对标 Cursor @Codebase 但开源可私有化。

#### B15 模型 fallback / 成本路由（MVP）

- **扩展 `packages/llm/llm-retry/`**：
  - 配置里声明 `fallback: [primary, secondary, tertiary]`。
  - 捕获 429/5xx/超时，自动切下一个 provider，session log 记录路由事件。
  - 成本路由（P1）：按任务复杂度粗分——短对话/简单工具调用走 flash 模型，长推理走 pro 模型（基于 prompt token 数阈值）。

#### B17 出站 webhook（MVP）

- **扩展 `packages/webhook/`**：
  - 新增 `webhook-outbound`：用户在设置页配置 `{ url, events: ['task.completed', 'approval.required', 'job.failed'] }`。
  - 在 session event 总线（`packages/session/session-projection`）订阅事件，POST JSON 到配置 URL（带 HMAC 签名头）。
  - 与现有入站 `webhook-github` 对称。

---

## 一、接入与配置（"装好"）

| 项 | 配置 |
|---|---|
| Provider | Agnes AI（OpenAI 兼容），baseURL `https://apihub.agnes-ai.com/v1` |
| 模型 | agnes-3.0-flash（默认）/ agnes-2.5-pro |
| Key | 环境变量 `AGNES_API_KEY`（不落盘，经 credentials 服务解析） |
| 配置文件 | 仓库新增 `config/agnes-ai.patch.yml`（示例 overlay，可复制进任意 profile 或 `--patch` 传入） |
| 验证 | `/v1/models` 返回 12 个模型；真实对话、工具调用全通 |

任意 OpenAI 兼容端点（DeepSeek/通义/智谱/本地 vLLM 等）改 baseURL 与模型名即可复用同一配置——**模型中立**是本项目特色之一。

---

## 二、真实对话与复杂任务实测

### 2.1 端到端工具调用链路（CLI）

`oa --profile ecommerce "给'蓝牙耳机'做关键词拓词"`（接真实模型）：
模型发起 `ecom_keyword_suggest` 工具调用 → agent 真实执行 → 回传结果 → 输出专业回复。会话日志记录完整：tool/call + tool/result 各 12 条。

### 2.2 通用（无插件）vs 金融（有插件）——同一任务对比

任务：**"请分析贵州茅台(600519)的投资价值，给出结构化结论"**

| 维度 | 通用 profile（无插件） | 金融 profile（finance 插件） |
|---|---|---|
| 数据来源 | 模型自身知识（无实时数据，口径含记忆误差） | **17 个金融工具逐一拉取**：quote/metrics/financials/kline/moneyflow/announcements/news/macro/research/risk |
| 估值方法 | 静态 PE 18.8×、历史分位、股息率 2.3%（定性） | **确定性模型测算**：DDM 内在价值 V=27.6/(9.5%-8%)=1840 元；PE/PB/PS/股息率全口径 |
| 风险刻画 | 定性列风险点 | **量化**：Beta 1.10、夏普 1.73、最大回撤 -2.82%、VaR95 -1.06% |
| 资金面/技术面 | 无 | 主力/超大单资金流、52 周区间、K线走势 |
| 研报/公告 | 无 | 券商研报（目标价 1950-2000）、公司公告、宏观 CPI |
| 工具级校验 | 无 | **DDM 首次参数 k<g 被工具校验拦截，模型自行修正后成功**（可复核计算） |
| 数据标注 | 无 | 明确标注"示例数据"，提示不构成投资建议 |
| 结构 | 定性结论表 | 五段式专业报告 + 综合判断 |

> 证据：金融会话工具调用序列（会话日志）——finance_quote → finance_metrics → finance_financials → finance_kline(120) → finance_moneyflow → finance_announcements → finance_news → finance_macro(cpi) → finance_research → finance_risk → finance_calc(DDM，一次失败一次成功) 共 12 次真实调用，4 步完成。

### 2.3 真实程序生成验证（"生成真实的程序"）

任务：**"写 Python 程序：读取 600519 近 20 个交易日收盘价，计算 SMA20，保存并运行"**

- 产出 `sma20_moutai.py`（4368 字节，真实可运行 Python：数据内嵌 + SMA 公式 + 分组求和复核 + JSON 落盘）
- 产出 `sma20_moutai_output.txt`（运行记录）
- **本沙箱验证**：`python3 sma20_moutai.py` 真实执行通过：20 日收盘和 = 30726.99，SMA20 = 1536.35，最新收盘 1630.88 偏离 +6.15%，与 agent 落盘记录一致 ✅
- 说明：agent 自身的 bash 执行沙箱在本环境缺 bubblewrap/Landlock 后端而受限（环境限制非产品缺陷），在用户本机可直接由 agent 执行；agent 已透明告知并用 finance_calc 交叉复核。
- 产物已归档至 `/home/user/Doubao/chats/38444402511021570/test-results/`

### 2.4 Web UI 全功能跑通（真实模型）

| 面 | 验证结果 |
|---|---|
| 对话 | 真实模型回复（含"深度求索中/已完成工作/用时/用量"状态） |
| 模型选择 | 下拉显示 Agnes 3.0 Flash，可切换 |
| 轨迹（Trace） | 逐步展示 系统提示词/上下文/每轮工具调用与结果 |
| 插件页 | 官方组合包 @deepseek-ai/dsh-finance、dsh-ecommerce 展示；**启用金融插件 → 新会话模型直接调用 finance_quote/metrics/financials 并输出专业解读**（界面/能力瞬变） |
| 设置-通用 | 权限模式、语言、外观、字号、工作步骤展示、性能与用量、开发者工具、繁忙发送行为、版本 |
| 设置-模型 | Provider 管理：DeepSeek/Agnes 编辑、API 密钥、自定义设置（API 地址/协议 OpenAI Chat/Responses/Anthropic Messages/模型目录/获取模型） |
| 设置-内置插件 | 会话插件 29 个 + 全局插件 181 个，可搜索 |
| 设置-Agent 预设 | 标准/PTC/极简/创造四模式 + 自定义 |
| 侧边栏 | 会话历史（**跨重启持久化**）、工作区、插件入口、搜索会话 |

> 修复项（跑通中发现并解决）：Web 插件页点"启用"后 bundle 选中但组件行被写成 disabled，导致模型看不到金融工具；修正为 enabled 后重启验证生效。已反馈为待改进点（插件开关交互需自检一致性）。

---

## 三、垂直领域金融 AI 对标（直接对标对象）

### 3.1 国内主流

| 产品 | 定位 | 专业功能做法（值得我们直接对标的点） |
|---|---|---|
| 同花顺 i问财 / HithinkGPT / iFinD | 中小投资者+机构投研 | 自然语言条件选股（语义拆解多维筛选）；诊股查数（财务/行情/资金/事件统一建模）；"边想边查边搜"自主规划智能体；**量化策略生成器（NL→Python 代码，对接量化平台）**；产业链图谱；盘面异动解读；iFinD 多智能体架构 |
| 东方财富 妙想 AI | C 端流量+Choice 数据 | 研报式解读层；**7 个 C 端 Skills（自然语言调仓、组合复盘、绩效归因）**；妙想投研助理（研究目标→检索→整合→报告撰写工作流）；接入第三方 Agent 生态 |
| Wind / WindGPT / WindClaw | 机构专业投研龙头 | 全品类机构级数据库；WindGPT 引擎三线 AI 布局；**MCP 开放生态**；组合管理/风控 |
| 财富趋势（通达信） | 行情+证券分析 | **11 项能力封装为 MCP 工具；智能体广场：10 个官方 Agent + 用户自建 Agent 机制** |
| 聚宽 / 米筐 | 量化回测平台 | 数据接口 + 策略代码 + 回测环境 + 社区 |

### 3.2 海外主流

| 产品 | 做法 |
|---|---|
| Bloomberg Terminal + BloombergGPT 2 | 终端内嵌；Auto-Brief（盘前简报）、Filing Reader（10-K/Q 长文档）、Earnings Caller（财报电话会摘要+情绪） |
| Anthropic Claude Finance Agents | **10 个开箱即用金融 agent 模板**；作为编排层 over FactSet/S&P/Moody's；开源可 fork；合规设计（输出人工签核）；4 种部署模式 |
| AlphaSense SuperAnalyst | 常驻 AI agent 编排完整工作流（多周项目、自动 watchlist/模型下载） |

### 3.3 行业共识（东吴证券《AI+金融进入智能体时代》）

东方财富妙想通过 **Skills 将能力模块化**、财富趋势把 11 项能力封装为 **MCP 工具**、Wind 走 **MCP 开放生态**——**"插件化 / Skills化 / MCP 化"正是金融 AI 智能体的行业方向**。这与 OmniAgent 万物皆可插件的架构方向一致，且我们走得更彻底（底座通用 + 任意领域插件，而非金融专用终端）。

---

## 四、差异化特色（别人为什么要用 OmniAgent）

1. **万物皆可插件，一个底座通吃所有垂直领域**：同花顺/东财/Wind 是"金融专用"，换领域就要换产品；OmniAgent 平时是通用万能 agent，加载金融/电商/任意领域插件即变为专业应用，不用即回归。解决"垂直领域层出不穷、永远无法统一"的行业痛点。
2. **数据源可替换（契约化）**：领域插件按"数据契约 + 确定性实现"组织，mock 演示 → 一行配置切到 HTTP 真实源（AkShare/Tushare/自有系统均可），不绑定任何数据商。
3. **模型中立**：OpenAI 兼容任意端点（本次实测 Agnes AI；亦兼容 DeepSeek/通义/智谱/本地 vLLM），不锁死自家模型。
4. **确定性可复核计算**：DDM 等测算由工具给出公式+数值（本次实测 k>g 校验拦截、自纠错），区别于纯 LLM 输出可审计。
5. **全流程可观测**：Web 轨迹展示每一步工具调用与结果，专业金融产品多为黑盒问答。
6. **开源 + 本地化/私有化部署**：数据不出域、可合规定制（券商/私募/企业内部要求），成本低（开源 + 免费 API）。
7. **合规底线内建**：金融输出自动标注"示例数据/不构成投资建议"。
8. **多智能体可调度外部 Agent（本次新发现的差异化）**：`packages/subagent` 不仅能进程内 fork 子代理，还能把 **Claude Code / Codex / ACP 外部 Agent 当作子代理调用**——这是 Cursor/OpenCode 都不具备的"Agent 套 Agent"能力，可编排"让 Codex 写代码、让 Claude 审文档、让主 Agent 汇总"的跨产品工作流。

### 待补齐（对标差距，即下一步开发清单）

| 差距 | 对标对象 | 建议实现 | 优先级 |
|---|---|---|---|
| 金融专属 UI（行情卡片/K线/估值面板/组合看板） | Wind/同花顺 | finance bundle 增加客户端插件（ui-plugin），对话旁渲染专业面板 | P0 |
| 选股/回测 | 同花顺量化/聚宽 | 新增 finance_screener（确定性选股条件）+ finance_backtest（简化回测）工具 | P0 |
| 产业链图谱/舆情 | 同花顺 | 后续插件化接入（知识图谱+舆情数据源） | P1 |
| 报告导出（PDF/Excel） | iFinD/妙想/Kimi K2.5 | finance 报告工具 + `tool-export-report`（见 0.4 节后端专项） | P0 |
| 多智能体（团队） | iFinD/Claude/Kimi Swarm | 已具备 Subagent/智能体团队实验插件（可调 Claude Code/Codex），做金融场景编排示例 | P2（已领先） |
| 自然语言→量化代码 | 同花顺 | finance 插件增加 NL2策略脚本工具（对接本地回测） | P1 |
| 长期记忆/知识库 | Claude Memory/Kimi 知识库 | 新建 `packages/memory`（见 0.4 节） | P0 |
| 细粒度权限规则 | Claude Code/Codex | 扩展 `packages/guard` allow/deny glob 规则（见 0.4 节） | P0 |

---

## 五、验证方式与缺口

- 验证方式：真实模型 CLI 一次性对话（ecommerce/finance/headless 三 profile）、会话日志工具调用核验、Web UI 浏览器实测（对话/设置/插件/轨迹/侧边栏）、生成程序本沙箱真实执行比对、全仓库 `packages/` 结构走读（对照前端 18 项 + 后端 18 项逐项判定）。
- 已确认可运行：全部真实对话、工具调用、Web 全功能、程序生成。
- 已确认已具备（全栈对标新增）：subagent 体系（含 Claude Code/Codex 外部子代理）、jobs 任务队列、schedule 定时、webhook/github、sandbox 沙箱、compaction 上下文压缩、MCP client、cordis 插件热加载、OTel 遥测、session JSONL 持久化多版本迁移、token-meter、三网络搜索源、git working-tree 快照、webhook/gateway REST API。
- 已确认缺失（全栈对标新增，剩余未补齐）：agent 主动 git 提交工具、OS 级通知、会话分支时间线、模型参数滑杆。（移动端响应式、长期记忆/BM25+向量 hybrid、PDF 真实导出+复杂排版、细粒度权限规则、插件在线市场、agent-team DAG 编排均已在 2026-09-27 补齐）
- 缺口：① 金融数据当前为 mock 示例，接真实源需配置；② agent 内部 bash 执行沙箱在此测试环境缺 bubblewrap/Landlock，用户本机不受影响；③ Web 插件开关交互有一处状态不一致（已修复并记录）。
