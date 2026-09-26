# @deepseek-ai/dsh-ecommerce-agent — OmniAgent 电商运营专业插件

OmniAgent 通用全能底座之上的**第二个领域插件示例**：挂载后向底座注入 8 个电商运营工具与电商领域系统提示词，让同一个 agent 立即具备电商专业能力（关键词拓词、标题优化、类目市场洞察、选品评估、评论分析、价格带分析、带货脚本、活动方案），同时**不削弱任何通用能力**（文件、执行、搜索、推理等照常可用）。

## 设计原则

- **可插拔**：插件与底座完全解耦，挂载即用、移除即恢复通用底座。
- **数据契约**：工具层只依赖 `EcommerceDataSource` 契约，与具体数据源解耦；当前内置确定性示例数据（mock），未来可按同一契约接入真实电商数据服务。
- **不编造数据**：所有市场规模/增速/价格带/搜索量均为示例数据并带 `mock` 标记，模型必须向用户明示。
- **计算可复核**：标题优化、评论分析、选品评估均为确定性规则计算，返回命中规则与公式，结果可手工验算。

## 工具清单（8 个）

| 工具 | 说明 |
|---|---|
| `ecom_keyword_suggest` | 关键词拓词（长尾词 + 搜索量 + 竞争度） |
| `ecom_title_optimize` | 商品标题优化（规则：长度/关键词嵌入/规格词/利益点词） |
| `ecom_market_insight` | 类目市场洞察（规模/增速/竞争度/12 个月季节指数） |
| `ecom_product_evaluate` | 选品评估（市场需求×竞争×利润×季节加权打分 0-100） |
| `ecom_review_analyze` | 评论分析（情感倾向 + 问题聚类 + 改进建议） |
| `ecom_price_compare` | 价格带分析（低/中/高价格带占比与均价 + 建议定价） |
| `ecom_script_suggest` | 短视频/直播带货脚本框架（钩子/痛点/卖点/背书/号召） |
| `ecom_campaign_plan` | 活动促销方案（节点玩法 + 让利测算 + 预热-爆发-返场节奏） |

## 使用

在任意 profile 中挂载（ecommerce profile 已内置）：

```yaml
- id: ecommerce-agent
  name: '@deepseek-ai/dsh-ecommerce-agent'
  config:
    source: mock
```

一键体验：

```bash
oa --profile ecommerce "帮我给'无线蓝牙耳机'拓词，看下数码配件类目市场"
oa --profile ecommerce "优化这个标题：蓝牙耳机，关键词加'降噪、长续航'"
oa --profile ecommerce "分析这条评论：物流太慢了，包装都压坏了，客服还不回复"
oa --profile ecommerce "评估选品：桌面加湿器，家居日用，售价39元，成本20元"
oa --profile ecommerce "美妆护肤的价格带分布怎么样？再给个双11活动方案"
```

## 冒烟测试

```bash
tsx packages/ecommerce/ecommerce-agent/smoke.mjs
```

## 实现

- `src/source.ts` — 数据契约与确定性 mock 数据源（类目表/价格带/季节指数/关键词生成）。
- `src/engine.ts` — 纯逻辑引擎：标题优化、评论分析、选品打分、活动方案（无随机，可复核）。
- `src/tools.ts` — 8 个工具定义（只依赖契约与引擎）。
- `src/index.ts` — Cordis 插件入口：注入 persona 与注册工具。

## 许可证

MIT
