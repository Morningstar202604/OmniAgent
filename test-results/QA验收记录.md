# 金融智能体 QA 验收记录

> 仓库：/home/user/Doubao/chats/38444402511021570/omniagent
> 模型：Agnes AI（OpenAI 兼容，https://api.agnes-ai.cn/v1，agnes-3.0-flash）
> 测试日期：2026-09-27
> 浏览器实测：computer_use_tool plane="bu"（CDP 驱动 Chromium）
> Headless 实测：直接调用 packages/finance 与 report-export 构建产物（lib/）

---

## 〇、构建验证链

| 步骤 | 命令 | 结果 |
|---|---|---|
| 1 | `npx tsc -b`（清理产物后全量类型构建） | ✅ exit 0 |
| 2 | `pnpm run build:lib:client` | ✅ exit 0（tsdown 全 client 包打包） |
| 3 | `pnpm run build:lib:host` | ✅ exit 0 |
| 4 | `pnpm run build:web` | ✅ exit 0（vite build 8.37s） |
| 5 | `DSH_HOME=/tmp/dsh-home-test AGNES_API_KEY=... node apps/cli/lib/bin.js --profile finance --patch config/agnes-ai.patch.yml --no-open --port 8631` | ✅ 启动，`dsh web: http://127.0.0.1:8631/?token=...` |

Agnes 端点连通性：`GET /v1/models` 返回 12 个模型，含 `agnes-3.0-flash`；`POST /v1/chat/completions` 真实对话通。

---

## 一、任务一：金融智能体 10 项功能逐项实测

| # | 功能项 | 实测方法 | 结果 | 证据 |
|---|---|---|---|---|
| 1 | 金融终端面板 | finance profile 启动后浏览器打开 | ✅ 中心区瞬变为「金融终端」：顶部标题栏（金融终端/行情/标的/研报/资讯）、行情条、标的详情+K线、研报公告资讯三栏、底部专业功能 dock；非通用 Hero | `01-finance-terminal-first-load.png` `02-finance-terminal-full.png` |
| 2 | 行情条刷新 | 间隔 ~15s 连续截图对比同一标的价格 | ✅ 数字持续变化：上证指数 3247.58→3269.60→3265.73→3284.00；红涨（+% 红字）绿跌（-% 绿字）符合 A 股配色 | `01` vs `01b-quote-bar-refreshed.png` |
| 3 | 标的详情与切换 | 依次点击行情条 贵州茅台 / 宁德时代 | ✅ 详情区随选中切换：茅台 600519 价 1685.34 +0.56%（红）；宁德 300750 价 187.20 -1.81%（绿，K线同步变绿）；选中 chip 下划线跟随 | `03-detail-maotai.png` `04-detail-catl.png` |
| 4 | K线技术指标 | 查看详情区 K 线上方指标行 | ✅ 日K走势图 + 指标行：MA5 / MA20 / RSI(14) / MACD 实时数值（茅台：MA5 1694.40 MA20 1665.31 RSI 65.9 MACD 1.840） | `03-detail-maotai.png` |
| 5 | 研报/公告/资讯三标签 | 依次点击三个 tab | ✅ 券商研报（4 条评级+目标价）/ 公司公告（季报/分红/回购/股东大会 4 类）/ 财经资讯（5 条宏观政策）切换正常 | `02` `05-tab-announcements.png` `06-tab-news.png` |
| 6 | 六大专业功能入口 | 查看底部专业功能 dock | ✅ 7 张入口卡：选股器 / 产业链图谱 / 财务分析 / 风险分析 / 宏观数据 / 板块行情 / 资金流向（底部提示「将调用 19 个金融工具」） | `02-finance-terminal-full.png` |
| 7 | 选股回测 finance_backtest | 对话框向真实 Agnes 提问「茅台双均线 MA5/MA20 回测 250 日」 | ✅ 真实 Agent 调用 finance_backtest，输出累计收益 -7.79%（年化 -8.46%）、最大回撤 -15.65%、夏普 -0.72、胜率 22.22%（18 笔、盈亏比 0.48）、期末权益 92.2 万；**与 headless 两次运行结果逐位一致** | `12-agent-backtest-real-model.png` `test-results/backtest-headless.txt` |
| 8 | NL→量化代码 finance_quant_code | 真实 Agent 生成 backtrader 策略代码 | ✅ 生成 `import backtrader as bt` 的 MaCross 策略类（SMA5/SMA20 金叉买死叉卖），含参数说明与风险提示，语法高亮渲染 | `13-agent-quant-code-real-model.png` |
| 9 | 报告导出 report_export | 真实 Agent 导出 PDF | ✅ 生成「贵州茅台(600519)双均线交叉策略回测报告-...pdf」卡片；落盘验证 `%PDF-1.3` 文件头、2 页、pdftotext 可提取中文/表格 | `14-agent-pdf-export-card.png`；`test-results/*.pdf` |
| 10 | 实时行情轮询 | 行情条 15s setInterval 模拟漂移（tickQuotes） | ✅ 同一会话多次截图价格自动漂移（见 #2），右上角「● 实时刷新（模拟行情）」呼吸灯 | `01b` |

### 7/8/9 的可复核数字（headless 复算）

```
finance_backtest(600519, dual_ma, MA5/MA20, 250日) 连续运行两次，JSON 完全一致：
  累计收益 -7.79% | 年化 -8.46% | 最大回撤 -15.65% | 夏普 -0.72
  胜率 22.22% | 18 笔交易 | 盈亏比 0.48 | 期末权益 922,124.48
公式：累计收益=(期末-初始)/初始×100；年化=((期末/初始)^(252/231)-1)×100；
      最大回撤=min((净值-历史峰值)/峰值)；夏普=(年化收益-无风险2%)/(日收益std×√252)
```

---

## 二、任务二：通用 ↔ 金融对比

| 维度 | web profile（无金融插件） | finance profile（有金融插件） |
|---|---|---|
| 启动后主界面 | 通用 Hero「万物皆可插件」+ 三张能力卡（通用底座/领域插件/高度自定义）+ 快速命令 + 对话输入 | 金融终端：行情条/标的详情/K线/研报公告资讯/专业功能 dock |
| 行情条 / 专业面板 | **无** | **有** |
| 插件树（--dump-default-config） | 无 finance/report-export/ui-finance | 含 finance-agent + report-export + ui-finance |
| 证据 | `11-web-profile-generic-hero.png` | `02-finance-terminal-full.png` |

结论：同一底座，仅组合包不同，界面「瞬变」得到验证——web profile 保持通用对话，finance profile 加载后中心区整体替换为专业终端。

---

## 三、任务三：选股器与产业链实测

### 3.1 选股器（PE≤20 且 ROE≥12%）

- 浏览器选股器面板设 PE 上限=20、ROE 下限=12 → **命中 9/30 只**，公式「PE∈[—, 20] 且 ROE≥12%」。
- 9 只：腾讯控股(18.4/28.4%)、中国平安(8.0/13.5%)、招商银行(6.5/16.2%)、中国神华(9.2/13.9%)、摩根大通(13.2/16.5%)、紫金矿业(11.8/22.5%)、五粮液(16.6/24.1%)、美的集团(13.6/22.8%)、万华化学(10.9/14.6%)。
- Headless 复核：`runScreener({maxPe:20,minRoe:12})` 逐只遍历全池过滤结果 = 9，与 UI 完全一致。
- 证据：`07-screener-all30.png`（全池30）、`08-screener-pe20-roe12-9of30.png`、`test-results/cli-screener-output.txt`（6 用例全过）。

### 3.2 产业链图谱

- 三列布局：上游·原材料（蓝）/ 中游·制造（紫）/ 下游·应用（绿），列间箭头连接。
- 节点可点击：点「动力电池」详情面板更新为「权重占比 22% / 电芯电池包 / 代表公司：宁德时代、比亚迪、中创新航」；点「电机电控」同理切换。
- 证据：`09-industry-chain.png`、`10-industry-chain-click.png`。

---

## 四、发现问题与修复记录

| 问题 | 根因 | 修复 | 验证 |
|---|---|---|---|
| 专业功能 dock 中「财务分析/风险分析/宏观数据/板块行情/资金流向」5 张卡片渲染为 `<button>` 但点击无任何响应（死按钮） | `FinancePanel.pickFunction` 只处理 screener/chain，其余 id 落入空分支 | 改为其余 id 调用 `backToChat()` 切回对话区，由 Agent 在对话中调用对应 finance_* 工具（与 dock 底部提示文案一致） | 重新 build:lib:client + build:web 后重启，点击「财务分析」正确切回对话（见 `15-dock-fix-navigates-to-chat.png`） |

> 备注：测试中多次遇到 Agnes 免费额度 429 限流（「已达到免费用户的 API 速率限制」），系外部账号额度限制，非产品缺陷；错峰重试后真实模型端到端跑通了回测/量化代码/PDF 导出三段链路。

---

## 五、产物归档

- 截图：`frontend-screens/01~15`（15 张）
- Headless 测试：`test-results/backtest-headless.txt`、`test-results/cli-screener-output.txt`、`test-results/report-export-headless.txt`
- 报告导出真实落盘：`test-results/*.pdf`（`%PDF-1.3`，pdftotext 可提取）
