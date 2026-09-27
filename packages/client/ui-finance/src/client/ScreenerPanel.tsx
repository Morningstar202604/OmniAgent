/**
 * 选股器面板：多条件筛选表单 + 可复核结果表格。
 * 前端在浏览器内对示例股票池做与后端 finance_screener 同口径的确定性过滤，
 * 每条结果附筛选公式与命中数；真实全市场行情待接 host RPC。
 */
import { useMemo, useState } from 'react'
import { SCREENER_UNIVERSE, SCREENER_INDUSTRIES, EMPTY_SCREENER, runScreener } from './mock.ts'
import type { ScreenerCriteria } from './mock.ts'
import { fmtPct } from './format.ts'
import css from './ScreenerPanel.module.css'

interface ScreenerPanelProps {
  onBack: () => void
}

/** 数字输入框（带单位后缀）。 */
function NumField(props: { label: string; value: string; unit?: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className={css.field}>
      <span className={css.fieldLabel}>{props.label}</span>
      <span className={css.fieldInputWrap}>
        <input
          className={css.fieldInput}
          type="number"
          step="0.1"
          value={props.value}
          placeholder={props.placeholder ?? '不限'}
          onChange={(e) => props.onChange(e.target.value)}
        />
        {props.unit ? <span className={css.unit}>{props.unit}</span> : null}
      </span>
    </label>
  )
}

export function ScreenerPanel({ onBack }: ScreenerPanelProps) {
  const [criteria, setCriteria] = useState<ScreenerCriteria>(EMPTY_SCREENER)
  const result = useMemo(() => runScreener(criteria), [criteria])

  const set = (key: keyof ScreenerCriteria) => (v: string) => setCriteria((prev) => ({ ...prev, [key]: v }))
  const reset = () => setCriteria(EMPTY_SCREENER)

  return (
    <div className={css.root} data-testid="finance-screener">
      <div className={css.toolbar}>
        <button type="button" className={css.backBtn} onClick={onBack}>← 返回</button>
        <span className={css.panelTitle}>选股器</span>
        <span className={css.mockTag}>示例股票池 {SCREENER_UNIVERSE.length} 只 · 数据待接真实行情</span>
      </div>

      <div className={css.formRow}>
        <label className={css.field}>
          <span className={css.fieldLabel}>市场</span>
          <select className={css.select} value={criteria.market} onChange={(e) => set('market')(e.target.value)}>
            <option value="">全部</option>
            <option value="cn">A股</option>
            <option value="hk">港股</option>
            <option value="us">美股</option>
          </select>
        </label>
        <label className={css.field}>
          <span className={css.fieldLabel}>行业</span>
          <select className={css.select} value={criteria.industry} onChange={(e) => set('industry')(e.target.value)}>
            <option value="">全部</option>
            {SCREENER_INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
          </select>
        </label>
        <NumField label="PE 下限" value={criteria.minPe} onChange={set('minPe')} />
        <NumField label="PE 上限" value={criteria.maxPe} onChange={set('maxPe')} />
        <NumField label="PB 上限" value={criteria.maxPb} onChange={set('maxPb')} />
        <NumField label="ROE 下限" unit="%" value={criteria.minRoe} onChange={set('minRoe')} />
        <NumField label="涨幅下限" unit="%" value={criteria.minChangePct} onChange={set('minChangePct')} />
        <NumField label="涨幅上限" unit="%" value={criteria.maxChangePct} onChange={set('maxChangePct')} />
        <button type="button" className={css.resetBtn} onClick={reset}>重置</button>
      </div>

      <div className={css.summary}>
        <span className={css.hit}>命中 {result.items.length} / {SCREENER_UNIVERSE.length} 只</span>
        <span className={css.formula}>筛选公式：{result.formula}</span>
      </div>

      <div className={css.tableWrap}>
        <table className={css.table}>
          <thead>
            <tr>
              <th>代码</th><th>名称</th><th>行业</th><th>最新价</th><th>涨跌幅</th>
              <th>PE</th><th>PB</th><th>ROE</th><th>市值</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr><td colSpan={9} className={css.empty}>无命中股票，请放宽筛选条件</td></tr>
            ) : result.items.map((row) => {
              const trend = row.changePct > 0 ? css.up : row.changePct < 0 ? css.down : css.flat
              const cap = row.marketCap >= 1e12
                ? `${(row.marketCap / 1e12).toFixed(2)}万亿`
                : `${(row.marketCap / 1e8).toFixed(0)}亿`
              return (
                <tr key={row.symbol}>
                  <td className={css.mono}>{row.symbol}</td>
                  <td className={css.name}>{row.name}</td>
                  <td>{row.industry}</td>
                  <td className={css.mono}>{row.price.toFixed(2)}</td>
                  <td className={`${css.mono} ${trend}`}>{fmtPct(row.changePct)}</td>
                  <td className={css.mono}>{row.pe.toFixed(1)}</td>
                  <td className={css.mono}>{row.pb.toFixed(2)}</td>
                  <td className={css.mono}>{row.roe.toFixed(1)}%</td>
                  <td className={css.mono}>{cap}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
