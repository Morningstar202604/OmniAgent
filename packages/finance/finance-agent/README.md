# @deepseek-ai/dsh-finance-agent — OmniAgent 金融专业插件

OmniAgent 通用全能底座之上的**首发专业插件**：挂载后向底座注入金融领域工具集与系统提示词，让同一个 agent 立即具备金融专业能力（行情、财务、估值、选股、金融计算、技术分析、汇率、利率），同时**不削弱任何通用能力**（文件、执行、搜索、推理等照常可用）。

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
```

## 工具清单（8 个）

### 数据查询（4）
| 工具 | 说明 | 关键参数 |
|---|---|---|
| `finance_quote` | 实时行情（最新价/涨跌/量/市值） | symbol, market(cn/hk/us) |
| `finance_financials` | 核心财务（营收/净利/毛利率/ROE/负债率/EPS） | symbol, market, year |
| `finance_metrics` | 估值技术面（PE/PB/PS/股息率/52周区间） | symbol, market |
| `finance_screener` | 条件选股（市场/行业/市值/PE/涨幅） | market, industry, minMarketCap, maxPe… |

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
- 数据契约冒烟：`node packages/finance/finance-agent/smoke.mjs`（10 项全通过）
- 端到端：`oa --profile finance "..."`（真实模型 + 工具调用）
