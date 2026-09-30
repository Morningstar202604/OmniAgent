# @deepseek-ai/dsh-finance-agent — OmniAgent 金融专业插件

OmniAgent 通用全能底座之上的**首发专业插件**：挂载后向底座注入金融领域工具集与系统提示词，让同一个 agent 立即具备金融专业能力（行情、财务、估值、选股、K线、资金流、公告、资讯、宏观、板块、风险指标、基金/债券/可转债、金融计算、技术分析、汇率、利率），同时**不削弱任何通用能力**（文件、执行、搜索、推理等照常可用）。

## 设计原则

- **可插拔**：插件与底座完全解耦，挂载即用、移除即恢复通用底座。
- **数据源可替换**：工具层只依赖统一数据契约，数据源（mock / http / 未来更多）对工具完全透明。
- **不编造数据**：所有行情/财务/估值数字必须经工具获取；示例数据明确标记。
- **计算可复核**：金融计算与技术指标返回公式与中间值，结果可手工验算。

## 使用

在任意 profile 中挂载（finance profile 已内置）：

```yaml
- id: finance-agent
  name: '@deepseek-ai/dsh-finance-agent'
  config:
    source: mock            # mock=内置示例；http=自定义网关
    # source: http
    # baseURL: https://your-finance-gateway.example/v1
    # apiKeyEnv: FINANCE_API_KEY
```

一键体验（推荐 `--profile finance`）：

```bash
oa --profile finance "查一下贵州茅台的最新行情和估值"
oa --profile finance "筛选 A 股中 PE 低于 20 的公司"
oa --profile finance "100 万本金、年利率 3%、5 年复利终值是多少"
oa --profile finance "按收盘价序列计算 RSI(14) 和 MACD"
oa --profile finance "查一下 USD/CNY 汇率和 5 年期 LPR"
oa --profile finance "贵州茅台最近30天日K线，用收盘价算一下MACD"
oa --profile finance "中国平安今天的主力资金流向如何"
oa --profile finance "贵州茅台最近有什么公告"
oa --profile finance "今天有什么重要财经新闻"
oa --profile finance "中国最新的CPI和PMI是多少"
oa --profile finance "今天哪些行业板块涨幅靠前"
oa --profile finance "分析贵州茅台的风险指标（Beta/夏普/最大回撤/VaR）"
oa --profile finance "对比几只基金的近一年收益，再查10年期国债收益率和某可转债溢价率"
oa --profile finance "查一下贵州茅台最近的券商研报和目标价"
oa --profile finance "上证指数现在多少点？标普500和恒生指数呢？"
```

## 工具清单（17 个）

### 数据查询（4）
| 工具 | 说明 | 关键参数 |
|---|---|---|
| `finance_quote` | 实时行情（最新价/涨跌/量/市值），支持股票+指数（上证/深证/沪深300/创业板/恒生/纳指/标普/道指） | symbol, market(cn/hk/us) |
| `finance_financials` | 核心财务（营收/净利/毛利率/ROE/负债率/EPS） | symbol, market, year |
| `finance_metrics` | 估值技术面（PE/PB/PS/股息率/52周区间） | symbol, market |
| `finance_screener` | 条件选股（市场/行业/市值/PE/涨幅） | market, industry, minMarketCap, maxPe… |

### 行情与资金（2）
| 工具 | 说明 | 关键参数 |
|---|---|---|
| `finance_kline` | 历史K线（日/周/月，OHLCV序列，可配合 finance_technical 做技术分析） | symbol, market, period(day/week/month), limit |
| `finance_moneyflow` | 资金流向（主力净流入/超大单/大单/中单/小单净额/主力净占比） | symbol, market |

### 公告与资讯（2）
| 工具 | 说明 | 关键参数 |
|---|---|---|
| `finance_announcements` | 公司公告（年报/季报/分红/重大事项，支持类别过滤） | symbol, market, category, limit |
| `finance_news` | 财经资讯/市场快讯（分类/关联个股，覆盖市场/宏观/公司/行业/政策） | category, limit, symbol |

### 宏观与板块（2）
| 工具 | 说明 | 关键参数 |
|---|---|---|
| `finance_macro` | 宏观经济指标（GDP/CPI/PPI/PMI/M2/社融/进出口/失业率，含同比环比） | indicator, period |
| `finance_sector` | 行业/概念板块行情（涨跌幅/领涨股/成交额/涨跌家数） | market, category(industry/concept), limit |

### 风险指标（1，纯计算可复核）
| 工具 | 说明 | 关键参数 |
|---|---|---|
| `finance_risk` | 个股风险指标（Beta/夏普比率/最大回撤/年化波动率/VaR95/VaR99），基于K线收盘价本地计算，输出公式与中间值 | symbol, market, benchmark, riskFreeRate, period |

### 固收资产（1）
| 工具 | 说明 | 关键参数 |
|---|---|---|
| `finance_fund` | 基金/债券/可转债三类资产数据：基金净值涨跌规模经理、国债收益率曲线+信用债YTM久期评级、可转债转股价/转股价值/溢价率/余额 | category(fund/bond/convertible), symbol, limit |

> **与 finance_rates 的边界**：`finance_rates` 是"利率快查"（存款/LPR/国债三档收益率的简洁列表）；`finance_fund` 侧重"资产/券种明细"（基金全字段、国债收益率曲线1Y/5Y/10Y/30Y+企业债/城投债明细、可转债条款），两者互补不冲突。

### 券商研报（1，摘要级轻量版）
| 工具 | 说明 | 关键参数 |
|---|---|---|
| `finance_research` | 券商研报摘要（标题/机构/分析师/评级/目标价/日期/核心观点），不提供全文，版权敏感做摘要级+免责 | symbol, market, limit |

### 金融计算（1，纯函数可复核）
| 工具 | 说明 | 模式 |
|---|---|---|
| `finance_calc` | 复利终值/现值、等额本息月供、年化收益率、股利折现(DDM) | compound_fv / compound_pv / loan / annual_return / ddm |

### 技术分析（1，纯函数可复核）
| 工具 | 说明 | 指标 |
|---|---|---|
| `finance_technical` | 均线/相对强弱/趋势/波动通道，传入收盘价序列即算 | sma / ema / rsi / macd / boll |

### 汇率与利率（2）
| 工具 | 说明 | 关键参数 |
|---|---|---|
| `finance_fx` | 主要货币对汇率（USD/CNY、EUR/CNY、HKD/CNY、JPY/CNY、GBP/CNY） | pair |
| `finance_rates` | 人民币利率：存款 / LPR / 国债收益率 | category: deposit / lpr / bond |

## 数据源

### mock（默认）
内置示例数据（贵州茅台、五粮液、中国平安、Apple、腾讯 + 汇率/利率），所有数据带 `mock: true` 标记，模型会向用户明示"示例数据"。

### http（对接真实数据）
配置 `source: http` + `baseURL` + `apiKeyEnv`，数据源按统一契约返回 JSON：

| 端点 | 参数 | 返回 |
|---|---|---|
| `GET {baseURL}/quote` | symbol, market | FinanceQuote |
| `GET {baseURL}/financials` | symbol, market, year | FinanceFinancials |
| `GET {baseURL}/metrics` | symbol, market | FinanceMetrics |
| `GET {baseURL}/screener` | market, industry, minMarketCap… | ScreenerRow[] |
| `GET {baseURL}/kline` | symbol, market, period, limit | FinanceKlineResult |
| `GET {baseURL}/moneyflow` | symbol, market | FinanceMoneyflow |
| `GET {baseURL}/announcements` | symbol, market, category, limit | FinanceAnnouncementResult |
| `GET {baseURL}/news` | category, limit, symbol | FinanceNewsResult |
| `GET {baseURL}/macro` | indicator, period | FinanceMacro |
| `GET {baseURL}/sector` | market, category, limit | FinanceSectorResult |
| `GET {baseURL}/risk` | symbol, market, benchmark, riskFreeRate, period | FinanceRiskResult |
| `GET {baseURL}/fund` | category, symbol, limit | FinanceFundResult |
| `GET {baseURL}/research` | symbol, market, limit | FinanceResearchResult |
| `GET {baseURL}/fx` | pair | FinanceFxRate |
| `GET {baseURL}/rates` | category | FinanceRateQuote[] |

认证：`Authorization: Bearer <apiKeyEnv 值>`（默认 `FINANCE_API_KEY`）。

### 契约字段
行情/财务/估值/汇率/利率对象需完整返回 `source.ts` 中声明的全部字段，缺失字段会导致工具校验失败（数据源侧负责补全）。

## 边界与合规

- 本插件提供**数据获取与分析能力**，不构成投资建议；金融 persona 要求区分"已查证数据"与"分析观点"，并给出风险提示。
- 接入真实数据源时请遵守数据源服务条款与相关法律法规。
- 示例数据仅用于功能演示，不可用于真实决策。

## 开发验证

- 类型检查：`pnpm --filter @deepseek-ai/dsh-finance-agent exec tsc --noEmit -p tsconfig.json`
- 数据契约冒烟：`node packages/finance/finance-agent/smoke.mjs`（59 项全通过）
- 端到端：`oa --profile finance "..."`（真实模型 + 工具调用）
