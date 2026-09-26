# @deepseek-ai/dsh-ecommerce-agent — OmniAgent Ecommerce Operations Plugin

The second domain-plugin example on top of OmniAgent's general-purpose base: once mounted, it injects 8 ecommerce operations tools and an ecommerce persona into the same agent — keyword suggestion, title optimization, market insight, product evaluation, review analysis, price-band analysis, selling scripts, and campaign planning — without weakening any general capability (files, execution, search, reasoning all keep working).

## Design principles

- **Pluggable**: the plugin is fully decoupled from the base — mount to use, detach to restore the general agent.
- **Data contract**: tools depend only on the `EcommerceDataSource` contract; the current source ships deterministic sample data (mock), and real ecommerce data services can be plugged in later behind the same contract.
- **No fabricated numbers**: all market size / growth / price-band / search-volume figures are sample data flagged `mock: true`, which the model must disclose.
- **Verifiable computation**: title optimization, review analysis, and product evaluation are deterministic rule calculations that return the applied rules and formulas.

## Tools (8)

| Tool | Purpose |
|---|---|
| `ecom_keyword_suggest` | Keyword expansion (long-tail words + volume + competition) |
| `ecom_title_optimize` | Title optimization (length / keyword embedding / spec / benefit words) |
| `ecom_market_insight` | Category market insight (size / growth / competition / 12-month seasonality) |
| `ecom_product_evaluate` | Product evaluation (weighted score 0–100: demand × competition × margin × season) |
| `ecom_review_analyze` | Review analysis (sentiment + issue clustering + suggestions) |
| `ecom_price_compare` | Price-band analysis (share and average price per band + suggested price) |
| `ecom_script_suggest` | Short-video / livestream script framework (hook / pain / selling / trust / CTA) |
| `ecom_campaign_plan` | Campaign plan (node plays + discount math + warm-up/peak/return rhythm) |

## Usage

Mount in any profile (the `ecommerce` profile ships built-in):

```yaml
- id: ecommerce-agent
  name: '@deepseek-ai/dsh-ecommerce-agent'
  config:
    source: mock
```

One-liner demos:

```bash
oa --profile ecommerce "帮我给'无线蓝牙耳机'拓词，看下数码配件类目市场"
oa --profile ecommerce "优化这个标题：蓝牙耳机，关键词加'降噪、长续航'"
oa --profile ecommerce "分析这条评论：物流太慢了，包装都压坏了，客服还不回复"
oa --profile ecommerce "评估选品：桌面加湿器，家居日用，售价39元，成本20元"
oa --profile ecommerce "美妆护肤的价格带分布怎么样？再给个双11活动方案"
```

## Smoke test

```bash
tsx packages/ecommerce/ecommerce-agent/smoke.mjs
```

## Implementation

- `src/source.ts` — data contract and deterministic mock source (categories / price bands / seasonality / keyword generation).
- `src/engine.ts` — pure logic engine: title optimization, review analysis, product scoring, campaign planning (no randomness).
- `src/tools.ts` — 8 tool definitions (depend only on the contract and engine).
- `src/index.ts` — Cordis plugin entry: persona injection and tool registration.

## License

MIT
