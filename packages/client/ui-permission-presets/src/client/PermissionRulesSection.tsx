/**
 * Fine-grained permission rule editor page: a list of wildcard rules with
 * colored level tags, an enable toggle, inline add/delete, and two quick
 * presets. Writes go through the `permissionRules.setRules` Remote.
 */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, Input, Switch, Tag } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PermissionLevel } from '@deepseek-ai/dsh-permission-rules/client'
import type { EditableRule, RulesEditorState } from './rules-store.ts'
import type { RulesKey } from './rules-locales.ts'
import css from './PermissionRulesSection.module.css'

/** Level → Tag tone mapping. */
const LEVEL_TONE: Record<PermissionLevel, 'success' | 'info' | 'warning' | 'danger'> = {
  allow: 'success',
  auto: 'info',
  ask: 'warning',
  deny: 'danger',
}

/** All four levels in display order. */
const LEVELS: readonly PermissionLevel[] = ['allow', 'auto', 'ask', 'deny']

/** Registration-side business face for the rule editor. */
export interface RulesSectionInjected {
  hooks: {
    /** Rules editor snapshot bound by the renderer as useRules. */
    rules: SnapshotStore<RulesEditorState>
  }
  /** (Re)load the engine state. */
  load: () => Promise<void>
  /** Persist the editable row list (enabled rows only reach the engine). */
  save: (rules: EditableRule[]) => Promise<void>
}

/** Full component props. */
export type PermissionRulesSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.rules'>
  & InjectFace<RulesSectionInjected>

/**
 * Render the rule editor.
 * @param props - composed slot props.
 * @returns the settings section body.
 */
export function PermissionRulesSection({ load, save, useRules, t }: PermissionRulesSectionProps) {
  const state = useRules(snapshot => snapshot)
  const [rows, setRows] = useState<EditableRule[]>([])
  const [pattern, setPattern] = useState('')
  const [level, setLevel] = useState<PermissionLevel>('ask')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Seed the local draft from the engine after each load/save settles.
  useEffect(() => {
    if (state.status === 'ready') setRows(state.rules)
  }, [state.status, state.rules])

  useEffect(() => {
    void load()
  }, [load])

  const busy = state.status === 'loading' || state.status === 'saving'
  const levelLabel = (lvl: PermissionLevel): string => t(`level.${lvl}`)

  const commit = (next: EditableRule[]): void => {
    setRows(next)
    void save(next)
  }

  const addRule = (): void => {
    const trimmed = pattern.trim()
    if (trimmed === '') return
    commit([...rows, { id: `local-${Date.now()}`, pattern: trimmed, level, enabled: true }])
    setPattern('')
  }

  const toggleRule = (id: string, enabled: boolean): void => {
    commit(rows.map(row => (row.id === id ? { ...row, enabled } : row)))
  }

  const changeLevel = (id: string, next: PermissionLevel): void => {
    commit(rows.map(row => (row.id === id ? { ...row, level: next } : row)))
  }

  const removeRule = (id: string): void => {
    commit(rows.filter(row => row.id !== id))
    setConfirmDeleteId(null)
  }

  const applyPreset = (presetRules: EditableRule[]): void => {
    commit(presetRules)
  }

  if (state.status === 'loading' && rows.length === 0) {
    return <div className={css.desc}>{t('loading')}</div>
  }

  return (
    <div className={css.wrap}>
      <div className={css.header}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.desc}>{t('description')}</div>
        <div className={css.current}>{t('current', { name: state.preset })}</div>
      </div>

      <div className={css.presets}>
        <button
          type="button"
          className={css.presetBtn}
          disabled={busy}
          onClick={() => { applyPreset([
            { id: 'preset-strict-shell', pattern: 'shell.*', level: 'deny', enabled: true },
            { id: 'preset-strict-git', pattern: 'git_*', level: 'ask', enabled: true },
          ]) }}
        >
          <span className={css.presetName}>{t('preset.strict')}</span>
          <span className={css.presetDesc}>{t('preset.strict.desc')}</span>
        </button>
        <button
          type="button"
          className={css.presetBtn}
          disabled={busy}
          onClick={() => { applyPreset([
            { id: 'preset-relaxed-all', pattern: '*', level: 'auto', enabled: true },
          ]) }}
        >
          <span className={css.presetName}>{t('preset.relaxed')}</span>
          <span className={css.presetDesc}>{t('preset.relaxed.desc')}</span>
        </button>
      </div>

      {state.error !== null && <div className={css.errorBox} role="alert">{state.error}</div>}

      <div className={css.list}>
        {rows.length === 0 && <div className={css.empty}>{t('empty')}</div>}
        {rows.map(row => (
          <div key={row.id} className={`${css.row} ${row.enabled ? '' : css.rowDisabled}`}>
            <span className={css.pattern} title={row.pattern}>{row.pattern}</span>
            <Tag tone={LEVEL_TONE[row.level]} className={css.tag}>{levelLabel(row.level)}</Tag>
            <div className={css.rowActions}>
              <select
                aria-label={t('add.level')}
                value={row.level}
                disabled={busy}
                onChange={event => { changeLevel(row.id, event.target.value as PermissionLevel) }}
              >
                {LEVELS.map(lvl => <option key={lvl} value={lvl}>{levelLabel(lvl)}</option>)}
              </select>
              <Switch
                checked={row.enabled}
                disabled={busy}
                onChange={next => { toggleRule(row.id, next) }}
                label={row.pattern}
              />
              {confirmDeleteId === row.id
                ? (
                  <span className={css.rowActions}>
                    <Button size="sm" variant="primary" onClick={() => { removeRule(row.id) }}>{t('confirm')}</Button>
                    <Button size="sm" onClick={() => { setConfirmDeleteId(null) }}>{t('cancel')}</Button>
                  </span>
                )
                : (
                  <button
                    type="button"
                    className={css.deleteBtn}
                    disabled={busy}
                    onClick={() => { setConfirmDeleteId(row.id) }}
                  >
                    {t('delete')}
                  </button>
                )}
            </div>
          </div>
        ))}
      </div>

      <div className={css.addBar}>
        <Input
          className={css.patternInput ?? ''}
          placeholder={t('add.pattern.placeholder')}
          value={pattern}
          disabled={busy}
          onChange={event => { setPattern(event.target.value) }}
          onKeyDown={event => { if (event.key === 'Enter') addRule() }}
        />
        <select
          aria-label={t('add.level')}
          value={level}
          disabled={busy}
          onChange={event => { setLevel(event.target.value as PermissionLevel) }}
        >
          {LEVELS.map(lvl => <option key={lvl} value={lvl}>{levelLabel(lvl)}</option>)}
        </select>
        <Button variant="primary" disabled={busy || pattern.trim() === ''} onClick={addRule}>
          {t('add')}
        </Button>
      </div>
    </div>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Fine-grained rule editor copy. */
    'settings.rules': RulesKey
  }
}
