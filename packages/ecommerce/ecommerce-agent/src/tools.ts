/**
 * 电商运营工具集：关键词、标题、市场、选品、评论、价格、脚本、活动八个模型可调用工具。
 * 所有工具只依赖 {@link EcommerceDataSource} 契约与 engine 纯逻辑，与数据源解耦。
 * @module @deepseek-ai/dsh-ecommerce-agent/src/tools
 */

import { defineTool, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import type { EcommerceDataSource } from './source.ts'
import { parseCategory, parsePlatform, parseCampaignNode } from './source.ts'
import { optimizeTitle, analyzeReview, evaluateProduct, buildCampaign } from './engine.ts'

/** 稳定的错误提示（数据源失败时给模型可行动的指引）。 */
function dataSourceError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error)
  return new Error(`ecommerce 数据源调用失败：${message}。示例数据源无需任何配置，如属参数错误请按提示修正后重试。`)
}

/** 构建八个电商运营工具定义。 */
export function buildEcommerceTools(source: EcommerceDataSource): ToolDefinition[] {
  const keywordSuggest: ToolDefinition = defineTool({
    name: 'ecom_keyword_suggest',
    description: '关键词拓词：输入核心词，返回长尾关键词及其搜索量、竞争度（示例数据，用于标题/投放选词参考）。',
    parameters: {
      seed: { type: 'string', required: true, description: '核心关键词，如"蓝牙耳机"' },
      count: { type: 'number', description: '返回数量，默认 10，最大 20' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          seed: { type: 'string', required: true },
          keywords: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                word: { type: 'string', required: true },
                volume: { type: 'number', required: true },
                competition: { type: 'string', required: true },
              },
            },
          },
          mock: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `核心词「${value.seed}」拓词 ${value.keywords.length} 条（示例数据）：`,
          ...value.keywords.map(k => `${k.word}｜搜索量 ${k.volume}｜竞争度 ${k.competition}`),
          '提示：示例数据仅用于演示流程，真实投放前请用平台工具核实。',
        ].join('\n'),
      }],
    },
    async execute(args: { seed: string; count?: number }) {
      try {
        const keywords = source.keywords(args.seed, args.count ?? 10)
        return {
          seed: args.seed,
          keywords: keywords.map(k => ({ word: k.word, volume: k.volume, competition: k.competition })),
          mock: true,
        }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const titleOptimize: ToolDefinition = defineTool({
    name: 'ecom_title_optimize',
    description: '商品标题优化：基于规则（长度、关键词嵌入、规格词、利益点词）给出优化标题、命中规则与建议，确定性可复核。',
    parameters: {
      title: { type: 'string', required: true, description: '原标题，如"无线蓝牙耳机"' },
      keywords: { type: 'array', items: { type: 'string' }, description: '候选关键词列表，按优先级排列，最多用前 2 个' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          optimized: { type: 'string', required: true },
          appliedRules: { type: 'array', items: { type: 'string' }, required: true },
          keywordsUsed: { type: 'array', items: { type: 'string' }, required: true },
          reason: { type: 'string', required: true },
          mock: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `优化后标题：${value.optimized}`,
          ...value.appliedRules.map(rule => `· ${rule}`),
          value.reason,
        ].join('\n'),
      }],
    },
    async execute(args: { title: string; keywords?: string[] }) {
      const result = optimizeTitle(args.title, args.keywords ?? [])
      return { ...result, mock: false }
    },
  })

  const marketInsight: ToolDefinition = defineTool({
    name: 'ecom_market_insight',
    description: '类目市场洞察：市场规模、增速、竞争度与 12 个月季节指数（示例数据）。',
    parameters: {
      category: { type: 'string', required: true, enum: ['数码配件', '家居日用', '美妆护肤', '食品饮料', '服饰鞋包', '母婴玩具'], description: '类目' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string', required: true },
          marketSize: { type: 'number', required: true },
          growthPct: { type: 'number', required: true },
          competition: { type: 'string', required: true },
          seasonality: { type: 'array', items: { type: 'number' }, required: true },
          updatedAt: { type: 'string', required: true },
          mock: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `类目「${value.category}」市场洞察（${value.updatedAt}）：`,
          `市场规模约 ${value.marketSize} 亿元，年增速 ${value.growthPct}%，竞争度 ${value.competition}`,
          `季节指数（1-12月）：${value.seasonality.map(v => v.toFixed(1)).join(' / ')}（>1 为旺季）`,
        ].join('\n'),
      }],
    },
    async execute(args: { category: string }) {
      try {
        const category = parseCategory(args.category)
        return source.marketInsight(category)
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const productEvaluate: ToolDefinition = defineTool({
    name: 'ecom_product_evaluate',
    description: '选品评估：按市场需求×竞争度×利润空间×季节适配加权打分（0-100），返回分项得分与结论（示例数据）。',
    parameters: {
      name: { type: 'string', required: true, description: '候选商品名称，如"桌面加湿器"' },
      category: { type: 'string', required: true, enum: ['数码配件', '家居日用', '美妆护肤', '食品饮料', '服饰鞋包', '母婴玩具'], description: '类目' },
      price: { type: 'number', required: true, description: '计划售价（元）' },
      cost: { type: 'number', required: true, description: '采购/生产成本（元）' },
      month: { type: 'number', description: '当前月份（1-12），用于季节适配，默认按当前月' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', required: true },
          total: { type: 'number', required: true },
          parts: {
            type: 'object', additionalProperties: false,
            properties: {
              demand: { type: 'number', required: true },
              competition: { type: 'number', required: true },
              margin: { type: 'number', required: true },
              season: { type: 'number', required: true },
            },
          },
          verdict: { type: 'string', required: true },
          reason: { type: 'string', required: true },
          mock: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `选品「${value.name}」评估：${value.verdict}（${value.total}/100）`,
          value.reason,
        ].join('\n'),
      }],
    },
    async execute(args: { name: string; category: string; price: number; cost: number; month?: number }) {
      try {
        const category = parseCategory(args.category)
        const month = args.month === undefined ? new Date().getMonth() + 1 : args.month
        const seasonIndex = source.seasonIndex(category, month)
        const result = evaluateProduct(category, args.price, args.cost, seasonIndex)
        return { name: args.name, ...result, mock: true }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const reviewAnalyze: ToolDefinition = defineTool({
    name: 'ecom_review_analyze',
    description: '评论分析：词库规则法给出情感倾向（好评/中评/差评）、问题聚类（质量/物流/客服/包装/尺码/价格）与改进建议，确定性可复核。',
    parameters: {
      text: { type: 'string', required: true, description: '评论文本，如"物流太慢了，包装都压坏了"' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sentiment: { type: 'string', required: true },
          score: { type: 'number', required: true },
          issues: { type: 'array', items: { type: 'string' }, required: true },
          suggestion: { type: 'string', required: true },
          mock: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `情感倾向：${value.sentiment}（得分 ${value.score}）`,
          `问题聚类：${value.issues.length > 0 ? value.issues.join('、') : '未命中常见问题词库'}`,
          `改进建议：${value.suggestion}`,
        ].join('\n'),
      }],
    },
    async execute(args: { text: string }) {
      return { ...analyzeReview(args.text), mock: false }
    },
  })

  const priceCompare: ToolDefinition = defineTool({
    name: 'ecom_price_compare',
    description: '竞品价格带分析：类目低/中/高价格带占比与均价，并给出建议定价（示例数据）。',
    parameters: {
      category: { type: 'string', required: true, enum: ['数码配件', '家居日用', '美妆护肤', '食品饮料', '服饰鞋包', '母婴玩具'], description: '类目' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: { type: 'string', required: true },
          bands: {
            type: 'array', required: true,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                band: { type: 'string', required: true },
                share: { type: 'number', required: true },
                avgPrice: { type: 'number', required: true },
              },
            },
          },
          suggestedPrice: { type: 'number', required: true },
          updatedAt: { type: 'string', required: true },
          mock: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `类目「${value.category}」价格带分布（${value.updatedAt}）：`,
          ...value.bands.map(b => `· ${b.band} 占比 ${(b.share * 100).toFixed(0)}%，均价 ¥${b.avgPrice}`),
          `建议定价参考：¥${value.suggestedPrice}（中价格带均价）`,
        ].join('\n'),
      }],
    },
    async execute(args: { category: string }) {
      try {
        const category = parseCategory(args.category)
        return source.priceBands(category)
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  const scriptSuggest: ToolDefinition = defineTool({
    name: 'ecom_script_suggest',
    description: '短视频/直播带货脚本建议：按平台给出 3 秒钩子、痛点、卖点、信任背书与行动号召的结构化脚本框架（示例建议，非承诺数据）。',
    parameters: {
      product: { type: 'string', required: true, description: '商品名称与核心卖点，如"无线蓝牙耳机，续航30小时"' },
      platform: { type: 'string', enum: ['douyin', 'kuaishou', 'taobao', 'jd'], description: '平台，默认 douyin' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          product: { type: 'string', required: true },
          platform: { type: 'string', required: true },
          hook: { type: 'string', required: true },
          pain: { type: 'string', required: true },
          selling: { type: 'string', required: true },
          trust: { type: 'string', required: true },
          cta: { type: 'string', required: true },
          mock: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `「${value.product}」${value.platform} 脚本框架（示例）：`,
          `3秒钩子：${value.hook}`,
          `痛点切入：${value.pain}`,
          `卖点展示：${value.selling}`,
          `信任背书：${value.trust}`,
          `行动号召：${value.cta}`,
        ].join('\n'),
      }],
    },
    async execute(args: { product: string; platform?: string }) {
      const platform = parsePlatform(args.platform)
      return {
        product: args.product,
        platform,
        hook: `还在为${args.product.split('，')[0] ?? args.product}踩坑？看完这条再下单`,
        pain: '先讲用户最痛的使用场景（噪音/续航/尺寸/价格顾虑），3 秒内建立共鸣',
        selling: `拆解 ${args.product} 的 2-3 个可验证卖点，演示真实使用画面而非口播参数`,
        trust: `展示销量/好评截图、工厂或资质背书，${platform === 'douyin' ? '挂车跳转前再给一次优惠' : '强调售后保障与正品承诺'}`,
        cta: '限时优惠 + 点击下方链接，库存不多先到先得',
        mock: true,
      }
    },
  })

  const campaignPlan: ToolDefinition = defineTool({
    name: 'ecom_campaign_plan',
    description: '活动促销方案：按类目与节点给出玩法组合、让利幅度测算（毛利率×50% 上限）与预热-爆发-返场节奏（示例建议）。',
    parameters: {
      category: { type: 'string', required: true, enum: ['数码配件', '家居日用', '美妆护肤', '食品饮料', '服饰鞋包', '母婴玩具'], description: '类目' },
      node: { type: 'string', enum: ['日常', '618', '双11', '双12', '年货节', '开学季', '女神节', '国庆'], description: '活动节点，默认日常' },
      margin: { type: 'number', description: '毛利率（0-1），默认 0.4，用于让利测算' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          node: { type: 'string', required: true },
          plays: { type: 'array', items: { type: 'string' }, required: true },
          discount: { type: 'string', required: true },
          rhythm: { type: 'array', items: { type: 'string' }, required: true },
          note: { type: 'string', required: true },
          mock: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: [
          `「${value.node}」活动方案（${value.plays.join(' + ')}）`,
          value.discount,
          ...value.rhythm.map(step => `· ${step}`),
          value.note,
        ].join('\n'),
      }],
    },
    async execute(args: { category: string; node?: string; margin?: number }) {
      try {
        const category = parseCategory(args.category)
        const node = parseCampaignNode(args.node)
        const margin = args.margin === undefined ? 0.4 : Math.max(0, Math.min(0.9, args.margin))
        const plan = buildCampaign(category, node, margin)
        return { ...plan, mock: true }
      } catch (error) {
        throw dataSourceError(error)
      }
    },
  })

  return [keywordSuggest, titleOptimize, marketInsight, productEvaluate, reviewAnalyze, priceCompare, scriptSuggest, campaignPlan]
}
