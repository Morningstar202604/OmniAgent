/**
 * 产业链图谱：新能源汽车产业链上中下游结构可视化。
 * 纯 CSS/三列布局（上游→中游→下游），节点卡片可点击查看详情；
 * 不引 d3/echarts 等重型图库。数据为前端示意，待接行业真实数据。
 */
import { useState } from 'react'
import { EV_CHAIN } from './mock.ts'
import type { ChainNode } from './mock.ts'
import css from './IndustryChain.module.css'

interface IndustryChainProps {
  onBack: () => void
}

/** 单个环节节点卡片。 */
function NodeCard(props: { node: ChainNode; active: boolean; onClick: () => void }) {
  const { node, active, onClick } = props
  return (
    <button type="button" className={`${css.node}${active ? ` ${css.nodeActive}` : ''}`} onClick={onClick}>
      <span className={css.nodeName}>{node.name}</span>
      <span className={css.nodeWeight}>权重 {node.weight}%</span>
    </button>
  )
}

export function IndustryChain({ onBack }: IndustryChainProps) {
  const [selectedId, setSelectedId] = useState<string>(EV_CHAIN.midstream[1]?.id ?? EV_CHAIN.midstream[0]?.id ?? '')
  const allNodes = [...EV_CHAIN.upstream, ...EV_CHAIN.midstream, ...EV_CHAIN.downstream]
  const selected = allNodes.find((n) => n.id === selectedId) ?? allNodes[0]

  const columns: { stage: string; nodes: ChainNode[]; cls: string | undefined }[] = [
    { stage: '上游 · 原材料', nodes: EV_CHAIN.upstream, cls: css.colUp },
    { stage: '中游 · 制造', nodes: EV_CHAIN.midstream, cls: css.colMid },
    { stage: '下游 · 应用', nodes: EV_CHAIN.downstream, cls: css.colDown },
  ]

  return (
    <div className={css.root} data-testid="finance-chain">
      <div className={css.toolbar}>
        <button type="button" className={css.backBtn} onClick={onBack}>← 返回</button>
        <span className={css.panelTitle}>产业链图谱</span>
        <span className={css.mockTag}>{EV_CHAIN.name} · 结构示意，数据待接真实行业数据</span>
      </div>

      <div className={css.flow}>
        {columns.map((col, ci) => (
          <div className={css.stageGroup} key={col.stage}>
            <div className={`${css.stageLabel} ${col.cls}`}>{col.stage}</div>
            <div className={css.nodeList}>
              {col.nodes.map((node) => (
                <NodeCard key={node.id} node={node} active={node.id === selected?.id} onClick={() => setSelectedId(node.id)} />
              ))}
            </div>
            {ci < columns.length - 1 ? <span className={css.arrow}>→</span> : null}
          </div>
        ))}
      </div>

      {selected ? (
        <div className={css.detail} data-testid="finance-chain-detail">
          <div className={css.detailHead}>
            <span className={css.detailName}>{selected.name}</span>
            <span className={css.detailWeight}>权重占比 {selected.weight}%</span>
          </div>
          <p className={css.desc}>{selected.desc}</p>
          <div className={css.companies}>
            <span className={css.compLabel}>代表公司：</span>
            {selected.companies.map((c) => <span key={c} className={css.comp}>{c}</span>)}
          </div>
        </div>
      ) : null}
    </div>
  )
}
