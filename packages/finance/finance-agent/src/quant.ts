/**
 * 自然语言 → 量化策略代码生成器（最小可用版，确定性模板生成，不调用 LLM）。
 *
 * 输入用户描述的策略意图与关键参数，输出：
 *  - 结构化策略代码（Python，backtrader 风格，可直接阅读/改造后回测）
 *  - 策略参数说明
 *  - 风险提示
 *
 * 支持模板：ma_cross（均线交叉）、rsi（超买超卖）、boll（布林带突破）、
 * momentum（动量）、dca（定投）。
 *
 * 生成代码与 finance_backtest 的策略口径一致，便于对照复核。
 *
 * @module @deepseek-ai/dsh-finance-agent/src/quant
 */

/** 支持的策略模板 id。 */
export type QuantTemplate = 'ma_cross' | 'rsi' | 'boll' | 'momentum' | 'dca'

/** 代码生成入参。 */
export interface QuantCodeParams {
  template: QuantTemplate
  /** 标的代码注释用（如 600519）。 */
  symbol: string
  /** 短期/快速窗口。 */
  shortWindow: number
  /** 长期/慢速窗口。 */
  longWindow: number
  /** RSI 超买阈值。 */
  rsiOverbought: number
  /** RSI 超卖阈值。 */
  rsiOversold: number
  /** 每次开仓仓位比例（0~1）。 */
  positionPct: number
}

/** 代码生成结果。 */
export interface QuantCodeResult {
  template: QuantTemplate
  /** 策略中文名。 */
  templateName: string
  /** 生成的 Python 代码。 */
  code: string
  /** 参数说明。 */
  params: { name: string; value: number | string; description: string }[]
  /** 风险提示。 */
  warnings: string[]
}

/** 通用风险提示。 */
const COMMON_WARNINGS = [
  '本代码由模板自动生成，仅作策略思路的可执行表达，不构成投资建议。',
  '历史回测表现不代表未来收益；A股有涨跌停、滑点、停牌、分红除权等真实摩擦，本模型未全部模拟。',
  '回测未考虑流动性冲击与成交可行性，实盘前需用真实历史数据做样本外检验。',
]

/** 均线交叉策略代码（backtrader 风格）。 */
function maCrossCode(p: QuantCodeParams): string {
  return `"""
均线交叉策略（shortWindow=${p.shortWindow} / longWindow=${p.longWindow}）
标的：${p.symbol}  ——  由 finance_quant_code 自动生成（backtrader 风格）
逻辑：SMA${p.shortWindow} 上穿 SMA${p.longWindow} 金叉买入；下穿死叉卖出。
"""
import backtrader as bt

class MaCross(bt.Strategy):
    params = dict(
        short=${p.shortWindow},
        long=${p.longWindow},
        order_pct=${p.positionPct},
    )

    def __init__(self):
        sma_s = bt.ind.SMA(period=self.p.short)
        sma_l = bt.ind.SMA(period=self.p.long)
        self.crossover = bt.ind.CrossOver(sma_s, sma_l)  # 金叉=1，死叉=-1

    def next(self):
        if not self.position and self.crossover > 0:      # 金叉买入
            self.order_target_percent(target=self.p.order_pct)
        elif self.position and self.crossover < 0:       # 死叉清仓
            self.close()

# cerebro = bt.Cerebro()
# cerebro.addstrategy(MaCross)
# data = bt.feeds.YahooFinanceData(dataname='${p.symbol}', fromdate=..., todate=...)
# cerebro.adddata(data); cerebro.run()
`
}

/** RSI 超买超卖策略代码。 */
function rsiCode(p: QuantCodeParams): string {
  return `"""
RSI 超买超卖策略（period=${p.longWindow}，超买>${p.rsiOverbought}，超卖<${p.rsiOversold}）
标的：${p.symbol}  ——  由 finance_quant_code 自动生成（backtrader 风格）
逻辑：RSI 跌破 ${p.rsiOversold} 买入；RSI 升破 ${p.rsiOverbought} 卖出。
"""
import backtrader as bt

class RsiRevert(bt.Strategy):
    params = dict(period=${p.longWindow}, overbought=${p.rsiOverbought},
                  oversold=${p.rsiOversold}, order_pct=${p.positionPct})

    def __init__(self):
        self.rsi = bt.ind.RSI(period=self.p.period)

    def next(self):
        if not self.position and self.rsi < self.p.oversold:
            self.order_target_percent(target=self.p.order_pct)
        elif self.position and self.rsi > self.p.overbought:
            self.close()
`
}

/** 布林带突破策略代码。 */
function bollCode(p: QuantCodeParams): string {
  return `"""
布林带突破策略（周期=${p.longWindow}，2 倍标准差）
标的：${p.symbol}  ——  由 finance_quant_code 自动生成（backtrader 风格）
逻辑：收盘价上破上轨买入；跌破中轨卖出。
"""
import backtrader as bt

class BollBreakout(bt.Strategy):
    params = dict(period=${p.longWindow}, dev=2.0, order_pct=${p.positionPct})

    def __init__(self):
        self.boll = bt.ind.BollingerBands(period=self.p.period, devfactor=self.p.dev)

    def next(self):
        if not self.position and self.data.close[0] > self.boll.top[0]:
            self.order_target_percent(target=self.p.order_pct)
        elif self.position and self.data.close[0] < self.boll.mid[0]:
            self.close()
`
}

/** 动量策略代码。 */
function momentumCode(p: QuantCodeParams): string {
  return `"""
动量策略（回看 ${p.longWindow} 日）
标的：${p.symbol}  ——  由 finance_quant_code 自动生成（backtrader 风格）
逻辑：过去 ${p.longWindow} 日涨幅为正且为区间领先则买入，转负则卖出。
"""
import backtrader as bt

class Momentum(bt.Strategy):
    params = dict(lookback=${p.longWindow}, order_pct=${p.positionPct})

    def __init__(self):
        self.roc = bt.ind.ROC(period=self.p.lookback)  # 变动率

    def next(self):
        if not self.position and self.roc[0] > 0:
            self.order_target_percent(target=self.p.order_pct)
        elif self.position and self.roc[0] < 0:
            self.close()
`
}

/** 定投策略代码。 */
function dcaCode(p: QuantCodeParams): string {
  return `"""
定期定额投资（定投）策略
标的：${p.symbol}  ——  由 finance_quant_code 自动生成（backtrader 风格）
逻辑：每 ${p.shortWindow} 个交易日投入固定金额，长期持有，不择时。
"""
import backtrader as bt

class DCA(bt.Strategy):
    params = dict(interval=${p.shortWindow}, cash_per_buy=10000)

    def __init__(self):
        self.day = 0

    def next(self):
        self.day += 1
        if self.day % self.p.interval == 0:
            # 用固定金额买入（按当前收盘价折算股数）
            size = self.p.cash_per_buy / self.data.close[0]
            self.buy(size=size)
`
}

/**
 * 根据模板与参数生成策略代码（确定性，无 LLM）。
 * @param p 策略参数。
 * @returns 结构化代码产物。
 */
export function generateQuantCode(p: QuantCodeParams): QuantCodeResult {
  const meta: Record<QuantTemplate, { name: string; code: (pp: QuantCodeParams) => string }> = {
    ma_cross: { name: '双均线交叉', code: maCrossCode },
    rsi: { name: 'RSI 超买超卖', code: rsiCode },
    boll: { name: '布林带突破', code: bollCode },
    momentum: { name: '动量策略', code: momentumCode },
    dca: { name: '定期定额（定投）', code: dcaCode },
  }
  const m = meta[p.template]
  const params = [
    { name: 'template', value: p.template, description: '策略模板' },
    { name: 'symbol', value: p.symbol, description: '标的代码' },
    { name: 'shortWindow', value: p.shortWindow, description: '短期/快速窗口（交易日）' },
    { name: 'longWindow', value: p.longWindow, description: '长期/慢速窗口（交易日）' },
    { name: 'rsiOverbought', value: p.rsiOverbought, description: 'RSI 超买阈值（仅 rsi 模板）' },
    { name: 'rsiOversold', value: p.rsiOversold, description: 'RSI 超卖阈值（仅 rsi 模板）' },
    { name: 'positionPct', value: p.positionPct, description: '单次开仓仓位比例（0~1）' },
  ]
  return {
    template: p.template,
    templateName: m.name,
    code: m.code(p),
    params,
    warnings: [...COMMON_WARNINGS, '生成代码为 backtrader 风格伪代码框架，需接入真实数据源后运行；与 finance_backtest 的口径一致可对照复核。'],
  }
}
