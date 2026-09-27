# OmniAgent 全面可用性验收报告（QA）

> 仓库：/home/user/Doubao/chats/38444402511021570/omniagent
> 模型：Agnes AI（https://api.agnes-ai.cn/v1，agnes-3.0-flash）
> 测试日期：2026-09-27
> 浏览器实测：computer_use_tool plane="bu"（CDP 驱动 Chromium）
> Headless 实测：直接调用构建产物（lib/）

---

## 〇、构建验证链

| 步骤 | 命令 | 结果 |
|---|---|---|
| 1 | `npx tsc -b`（全量类型构建） | ✅ exit 0 |
| 2 | `pnpm run build:lib:client` | ✅ exit 0 |
| 3 | `pnpm run build:lib:host` | ✅ exit 0 |
| 4 | `pnpm run build:web` | ✅ exit 0（vite build ~8s） |
| 5 | web profile 启动 | ✅ `http://127.0.0.1:3080/?token=...` |
| 6 | finance profile 启动 | ✅ `http://127.0.0.1:8631/?token=...` |

Agnes 新端点连通性：`GET /v1/models` 返回 11 个模型（agnes-2.0/2.5/3.0 系列 + image/video）；`POST /v1/chat/completions` 真实对话通。

---

## 一、web profile 设置页全项验收

### 1.1 通用设置（8 项，全部通过）

| # | 设置项 | 实测 | 结果 |
|---|---|---|---|
| 1 | 权限模式 | 三档切换（仅可查看/工作区内修改/完全权限），完全权限有风险确认弹窗 | ✅ |
| 2 | 语言 | 中文↔English 切换，整页 UI 同步 | ✅ |
| 3 | 外观 | 浅色/深色/跟随系统，主题变量自适应 | ✅ |
| 4 | 字号 | 步进器 14→17→18，内容字号实时变化 | ✅ |
| 5 | 工作步骤展示 | Compact/Standard/Detailed/Verbose 四档 | ✅ |
| 6 | 性能与用量 | Compact/Detailed 两档 | ✅ |
| 7 | 开发者工具 | 开关切换，落盘 cordis.patch.yml | ✅ |
| 8 | 繁忙时发送行为 | 排队发送/插话发送 | ✅ |

### 1.2 模型页（全部通过）

- 提供商列表：DeepSeek（无 key 红点）、Agnes AI（已配置绿点，来自 patch）
- Agnes 编辑：API 密钥由启动环境提供（只读），自定义设置显示 baseURL `https://api.agnes-ai.cn/v1`、协议 OpenAI Chat Completions
- "获取可用模型"：从新端点拉到 10+ 模型列表，证明端点+key 连通
- 生成参数滑杆：temperature 0.7→0.3、maxTokens 4096→8192，滑块联动、已保存
- 添加提供商：对话框可打开（第三方/自定义 API 两 tab）

### 1.3 其他页

| 页 | 结果 |
|---|---|
| 内置插件 | 会话插件 29 个、全局插件 194 个，列表正常 |
| Agent 预设 | 标准/PTC/极简/创造 四档 |
| 打开配置文件 | web 端禁用（浏览器无法调用本地编辑器，属预期） |
| 权限页 | 本版本为预设三档，无独立 deny 规则编辑器（已知差距 B5） |

---

## 二、通用智能体完整走通（11 项）

| # | 功能 | 实测 | 结果 |
|---|---|---|---|
| 1 | 真实对话 | Agnes 回复"我是 Agnes-3.0-flash，由 Sapiens AI 开发"，状态栏 102tok·s/11.6K tok | ✅ |
| 2 | 新建/切换/搜索会话 | 新建→历史列表→搜索"自我介绍"→切回，历史恢复 | ✅ |
| 3 | 分支会话 | 用户消息 hover 显示编辑/分叉图标，fork 后时间线子节点 | ✅ |
| 4 | 命令面板 | Ctrl+K 打开，新建会话/插件专区/主题切换/搜索过滤 | ✅ |
| 5 | 状态栏 | 模型/会话标题/token 用量/连接状态/时钟，深浅色自适应 | ✅ |
| 6 | 插件市场 | 搜索/分类/推荐·最新·安装量 tab/精选卡片/安装启用 | ✅ |
| 7 | 记忆 | memory_add 写入"偏好中文简洁"→新会话 memory_search 跨会话召回 | ✅ |
| 8 | 后台任务 | task_run 创建任务 ID，后台任务面板列表正常 | ✅ |
| 9 | 文件交付 | Agent 写 hello.txt 并调用 deliverables，磁盘落盘内容正确 | ✅ |
| 10 | 定时任务 | schedule_create 注册 schedule-1（2026-09-28 09:00） | ✅ |
| 11 | 工作区追踪 | 改动追踪面板显示文件变更 | ✅ |

### 配置拉满验证

权限→完全权限、工作步骤→完全展开、外观→深色、字号→16、开发者工具→开、安装"通用全能增强包"，全部落盘 `cordis.patch.yml`，应用无崩溃。

---

## 三、金融智能体完整走通（10 项）

| # | 功能 | 实测 | 结果 |
|---|---|---|---|
| 1 | 金融终端面板 | 启动后瞬变专业终端（行情条/标的详情/K线/研报/专业功能 dock） | ✅ |
| 2 | 行情条刷新 | 15s 轮询，上证 3247→3269→3284，红涨绿跌 | ✅ |
| 3 | 标的切换 | 茅台/宁德点击切换，详情+K线同步 | ✅ |
| 4 | K线指标 | MA5/MA20/RSI(14)/MACD 实时数值 | ✅ |
| 5 | 三标签 | 券商研报/公司公告/财经资讯切换 | ✅ |
| 6 | 六大入口 | 选股器/产业链/财务/风险/宏观/板块/资金流向 dock | ✅ |
| 7 | 选股回测 | finance_backtest：累计 -7.79%、回撤 -15.65%、夏普 -0.72、胜率 22.22%，与 headless 逐位一致 | ✅ |
| 8 | NL→量化代码 | finance_quant_code 生成 backtrader 风格 Python | ✅ |
| 9 | 报告导出 | PDF 落盘 %PDF-1.3，pdftotext 可提取中文 | ✅ |
| 10 | 实时行情轮询 | 15s setInterval 模拟漂移，呼吸灯提示 | ✅ |

### 通用↔金融对比

| 维度 | web profile | finance profile |
|---|---|---|
| 主界面 | 通用 Hero+三能力卡+对话 | 金融终端（行情条/标的/K线/专业 dock） |
| 金融面板 | 无 | 有 |
| 工具集 | 基础工具 | + finance_* / report_export / ui-finance |

结论：同一底座，仅组合包不同，界面"瞬变"验证通过。

### 选股器与产业链

- 选股器：PE≤20 且 ROE≥12% → 命中 9/30 只，headless 逐只复核一致
- 产业链：三列布局（上游/中游/下游），节点可点击切换详情

---

## 四、复杂真实场景任务

### 任务 A：金融综合——"贵州茅台深度研究"

真实工具序列：`finance_quote → finance_screener → finance_backtest → finance_quant_code → report_export → present`

**查验点**：
- 回测数字可复核：独立脚本直调 finance_backtest（period=280）复算，与 agent 输出逐位一致——累计收益 -10.41%、最大回撤 -15.28%、夏普 -0.87、胜率 20%、20 笔交易、期末权益 895,902.55；手工复算 (895902.55−100万)/100万=−10.41% ✅
- PDF 真实可读：%PDF-1.3 文件头 + %%EOF 尾 + pdftotext 提取 648 行 + 18 页 A4 + 18 个图表对象，中文渲染正常
- 过程：免费层 429 限流由 always 退避策略（30 次 RATE_LIMIT、176 次 retry）扛过，未跳步

### 任务 B：通用综合——"搭建前端项目并 git 提交"

真实工具序列：`write×3 → edit → bash 验证 → git 提交 → memory_add → permission_set(deny) → notify_send`

**查验点**：
- 三文件真实生成（index.html/style.css/main.js），`node --check` 语法通过
- git commit 真实发生：`git log` 实查 commit `4b9a0f1 feat: 初始待办事项前端应用`
- memory 落盘 `mem_mujjbnre_dga5qh`，DB 可召回
- deny 规则真实拦截：会话日志 3 处拒绝记录
- 通知已发出

---

## 五、发现问题与修复记录

| # | 问题 | 根因 | 修复 | 验证 | Commit |
|---|---|---|---|---|---|
| 1 | 专业功能 dock 5 张卡片（财务/风险/宏观/板块/资金流向）是死按钮 | FinancePanel.pickFunction 只处理 screener/chain，其余落入空分支 | 改为切回对话由 Agent 调用对应工具 | 点击正确切回对话 | `77b84e4` |
| 2 | PDF 表格长文本换行后与下一行重叠 | pdf.ts 行高固定 20pt，长公式列换行溢出 | 按 heightOfString 逐行自适应 + 行内翻页保护 | 重新渲染无重叠 | `e92984e` |

### 已知差距（非缺陷，记录在案）

- 权限 deny 规则编辑器：本版本为预设三档（仅可查看/工作区内修改/完全权限），无独立细粒度规则 UI（对应报告 B5，后端 permission-rules 工具已就绪）
- Agnes 免费层 429 限流：外部账号额度限制，前端优雅处理（重试 5/5 + RATE_LIMIT 提示），非产品缺陷
- 沙箱后端：本环境无 bubblewrap/Landlock，用 `DSH_PERMISSION_MODE=danger-full-access` 裸后端执行，属环境限制

---

## 六、产物归档

- 截图：`frontend-screens/`（设置页/通用功能/金融终端/复杂场景，共 65+ 张）
- 测试产物：`test-results/`（回测复核脚本/选股器输出/PDF 报告/性能报告）
- 验收记录：`test-results/QA验收记录.md`（金融智能体详细记录）

---

## 七、结论

**全面可用性验收通过**。设置页 8+ 项、通用智能体 11 项、金融智能体 10 项、复杂场景 2 个全部实测通过；发现 2 个真实缺陷已修复并回归验证；构建链四步全绿；Agnes 新端点连通正常。剩余为已知产品差距（权限 UI）和外部环境限制（API 限流/沙箱后端），不影响核心可用性。

---

## 八、巡检补充（2026-09-27 移动端响应式 + 自由巡检）

### 8.1 移动端响应式截图归档

用 CDP `Emulation.setDeviceMetricsOverride` 设置 375×812（iPhone X，dpr=3）实测 6 个场景，截图归档于 `frontend-screens/`：

| 文件 | 场景 | 结果 |
|---|---|---|
| `mobile-01-home.png` | 首页（欢迎弹窗态） | ✅ 弹窗窄屏自适应，文案清晰 |
| `mobile-01b-home-hero.png` | 首页 Hero（纯态） | ✅ 三能力卡单列堆叠，顶栏可读 |
| `mobile-02-history-empty.png` | 历史会话列表（窄屏） | ✅ 列表/时间线 tab 正常，空态提示清晰 |
| `mobile-03-plugin-market.png` | 插件市场（窄屏） | ✅ 单列卡片，分类标签换行正常 |
| `mobile-04-command-palette.png` | 命令面板 Ctrl+K | ✅ 弹窗全宽，命令列表清晰 |
| `mobile-05-finance-panel.png` | 金融面板（修复前） | ❌ 标题/徽章竖排——见 8.2 修复 |
| `mobile-05c-finance-fixed.png` | 金融面板（修复后） | ✅ 标题横排，徽章换行，代码完整 |
| `mobile-06-settings.png` | 设置页（修复前） | ❌ 表单内容逐字竖排——见 8.2 修复 |
| `mobile-06b-settings-fixed.png` | 设置页（修复后） | ✅ 导航收为顶部水平条，表单横排 |

### 8.2 巡检发现与修复

| # | 问题 | 根因 | 修复 | Commit |
|---|---|---|---|---|
| 3 | 金融终端 header 在 375px 下「金融终端」「演示数据」「实时刷新」全部竖排 | `.titleBlock` 无 `min-width:0`/`flex-wrap`，header `space-between` 把内容列压到单字宽 | titleBlock 加 `min-width:0`+`flex-wrap:wrap`，title/badge 禁止换行；`<480px` 时 header 允许换行、副标题收起 | `f3b4592` |
| 4 | 设置面板在 375px 下权限/语言/外观等标签与控件全部逐字竖排 | 固定 188px 导航栏占掉 327px 面板一半，内容列仅 ~140px | `<480px` 时 panel 改纵向堆叠，导航收为顶部水平可滚动条 | `3008964` |
| 5 | `tsc -b` 增量构建报 `TS2339: Property 'slots' does not exist on type 'Context'` | plugin-template 的 client 半边直接访问 `scope.slots` 未做类型断言（与 ui-plugin-market 同款写法遗漏） | 与 ui-plugin-market 一致加 `as unknown as { slots: SlotRegistry }` 断言 | （随 plugin-template 包提交） |

### 8.3 巡检结论

- **Agnes 429 限流体验**：llm-retry 插件在 step 详情面板（开发者工具）展示"已计划 N/M"重试计数与延迟，但普通对话视图只把 step 标红为 error，不显示"正在重试第 N 次"。**方案记录**：若需在普通视图显示重试计数，需在 step 列表渲染层增加 retry badge，成本中等；当前靠 step 详情可查，不强行实现。429 自动切备用模型涉及 provider 路由改造，成本较高，记录在案不实现。
- **README/usage-guide 一致性**：启动命令（`oa web` / `oa finance` / `oa headless`）、`--patch` 叠加配置、插件安装命令均与实际一致；`pnpm run start:web` 指向源码（tsx），`node apps/cli/lib/bin.js` 指向产物，两者用途不同均正确。
- **首启动/欢迎流程**：WelcomeNotice 弹窗在 web 和 finance 首次启动均弹出，文案中英文双语，"继续"按钮可关闭且状态持久化；窄屏下弹窗宽度自适应，无溢出。
- **构建链验证**：`npx tsc -b` → `build:lib:client` → `build:lib:host` → `build:web` 四步全绿（exit 0）。
- **隔离 DSH_HOME**：web 与 finance 分别用 `/tmp/dsh-home-web` 与 `/tmp/dsh-home-finance`，并行启动无互删。
