# @deepseek-ai/dsh-finance-agent — OmniAgent finance plugin

The **first professional plugin** on top of the OmniAgent general-purpose base: once mounted it injects a finance-domain tool set and system prompt, giving the same agent immediate finance capabilities (quotes, fundamentals, valuation, screening, K-line, money flow, announcements, news, macro, sectors, risk metrics, funds/bonds/convertibles, financial math, technical analysis, FX, rates) while **keeping every general capability intact** (files, execution, search, reasoning all keep working).

## Design principles

- **Pluggable**: fully decoupled from the base — mount to use, remove to restore the general base.
- **Replaceable data sources**: tools depend only on a unified data contract; sources (mock / http / more later) are transparent to tools.
- **No fabricated data**: every quote/fundamental/valuation number must come through a tool; sample data is explicitly marked.
- **Verifiable math**: financial calculations and technical indicators return formulas and intermediate values so results can be re-checked by hand.

## Usage

Mount in any profile (the `finance` profile ships with it):

```yaml
- id: finance-agent
  name: '@deepseek-ai/dsh-finance-agent'
  config:
    source: mock            # mock=built-in samples; http=custom gateway
    # source: http
    # baseURL: https://your-finance-gateway.example/v1
    # apiKeyEnv: FINANCE_API_KEY
```

One-liner experience (recommend `--profile finance`):

```bash
oa --profile finance "latest quote and valuation of Kweichow Moutai"
oa --profile finance "screen A-share companies with PE below 20"
oa --profile finance "compound future value of 1M principal, 3% annual rate, 5 years"
oa --profile finance "compute RSI(14) and MACD from the closing-price series"
oa --profile finance "USD/CNY rate and 5-year LPR"
oa --profile finance "Moutai 30-day daily K-line, MACD from close"
oa --profile finance "main money flow of Ping An today"
oa --profile finance "recent announcements of Moutai"
oa --profile finance "today's important finance news"
oa --profile finance "latest CPI and PMI for China"
oa --profile finance "which industry sectors lead today"
oa --profile finance "risk metrics of Moutai (Beta/Sharpe/max drawdown/VaR)"
oa --profile finance "compare 1-year returns of several funds, plus 10Y treasury yield and a convertible premium"
oa --profile finance "latest broker research and target price for Moutai"
oa --profile finance "Shanghai Composite now? S&P 500 and Hang Seng?"
```

## Tool catalog (17)

### Data queries (4)
| Tool | Description | Key params |
|---|---|---|
| `finance_quote` | Real-time quote (last/change/volume/market cap); stocks + indices (SSE/SZSE/CSI300/ChiNext/Hang Seng/Nasdaq/S&P/Dow) | symbol, market(cn/hk/us) |
| `finance_financials` | Core financials (revenue/net profit/gross margin/ROE/debt ratio/EPS) | symbol, market, year |
| `finance_metrics` | Valuation & technicals (PE/PB/PS/dividend yield/52-week range) | symbol, market |
| `finance_screener` | Conditional screening (market/industry/cap/PE/change) | market, industry, minMarketCap, maxPe… |

### Quotes & money flow (2)
| Tool | Description | Key params |
|---|---|---|
| `finance_kline` | Historical K-line (daily/weekly/monthly OHLCV; pairs with finance_technical) | symbol, market, period(day/week/month), limit |
| `finance_moneyflow` | Money flow (main net inflow/super-large/large/medium/small net, main net ratio) | symbol, market |

### Announcements & news (2)
| Tool | Description | Key params |
|---|---|---|
| `finance_announcements` | Company announcements (annual/interim/dividend/major events; category filter) | symbol, market, category, limit |
| `finance_news` | Finance news/market flashes (category/related symbols; market/macro/company/industry/policy) | category, limit, symbol |

### Macro & sectors (2)
| Tool | Description | Key params |
|---|---|---|
| `finance_macro` | Macro indicators (GDP/CPI/PPI/PMI/M2/social financing/import-export/unemployment; YoY+MoM) | indicator, period |
| `finance_sector` | Industry/concept sector quotes (change/leaders/turnover/advancers-decliners) | market, category(industry/concept), limit |

### Risk metrics (1, pure computation, verifiable)
| Tool | Description | Key params |
|---|---|---|
| `finance_risk` | Per-stock risk (Beta/Sharpe/max drawdown/annualized vol/VaR95/VaR99), computed locally from K-line closes, outputs formulas & intermediates | symbol, market, benchmark, riskFreeRate, period |

### Fixed income & convertibles (1)
| Tool | Description | Key params |
|---|---|---|
| `finance_fund` | Fund/bond/convertible data: fund NAV/change/AUM/manager; treasury yield curve + credit-bond YTM/duration/rating; convertible conversion price/value/premium/balance | category(fund/bond/convertible), symbol, limit |

> **Boundary with `finance_rates`**: `finance_rates` is a "quick rates lookup" (compact list of deposit/LPR/treasury yields); `finance_fund` focuses on "asset/security details" (full fund fields, treasury curve 1Y/5Y/10Y/30Y + corporate/city-investment bond details, convertible terms). Complementary, not conflicting.

### Broker research (1, summary-level, lightweight)
| Tool | Description | Key params |
|---|---|---|
| `finance_research` | Broker research summaries (title/firm/analyst/rating/target/date/key view); no full text — copyright-sensitive, summary-level + disclaimer | symbol, market, limit |

### Financial math (1, pure functions, verifiable)
| Tool | Description | Modes |
|---|---|---|
| `finance_calc` | Compound FV/PV, equal-installment monthly payment, annualized return, DDM | compound_fv / compound_pv / loan / annual_return / ddm |

### Technical analysis (1, pure functions, verifiable)
| Tool | Description | Indicators |
|---|---|---|
| `finance_technical` | MAs/RSI/trend/volatility bands; feed a closing-price series | sma / ema / rsi / macd / boll |

### FX & rates (2)
| Tool | Description | Key params |
|---|---|---|
| `finance_fx` | Major FX pairs (USD/CNY, EUR/CNY, HKD/CNY, JPY/CNY, GBP/CNY) | pair |
| `finance_rates` | CNY rates: deposits / LPR / treasury yields | category: deposit / lpr / bond |

## Data sources

### mock (default)
Built-in samples (Kweichow Moutai, Wuliangye, Ping An, Apple, Tencent + FX/rates). Every record carries a `mock: true` flag, and the model tells the user "sample data".

### http (real data)
Configure `source: http` + `baseURL` + `apiKeyEnv`; the source returns JSON per the unified contract:

| Endpoint | Params | Returns |
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

Auth: `Authorization: Bearer <apiKeyEnv value>` (default `FINANCE_API_KEY`).

### Contract fields
Quote/fundamental/valuation/FX/rate objects must return **all** fields declared in `source.ts`; missing fields fail tool validation (the source side is responsible for completeness).

## Boundaries & compliance

- This plugin provides **data retrieval and analysis**, not investment advice; the finance persona distinguishes "verified data" from "analyst view" and gives risk notices.
- When connecting real sources, follow their terms of service and applicable law.
- Sample data is for demo only and must not drive real decisions.

## Development verification

- Typecheck: `pnpm --filter @deepseek-ai/dsh-finance-agent exec tsc --noEmit -p tsconfig.json`
- Data-contract smoke: `node packages/finance/finance-agent/smoke.mjs` (all 59 checks pass)
- E2E: `oa --profile finance "..."` (real model + tool calls)
