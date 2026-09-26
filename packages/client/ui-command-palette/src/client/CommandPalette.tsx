/** OmniAgent 全局命令面板：OpenCode/Cursor 风格快速动作。 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { IconSearchOutlineRegular, IconNewChatOutlineRegular, IconPluginPinwheelOutlineRegular, IconSendOutlineRegular, IconLightOutlineRegular, IconDarkOutlineRegular, IconFollowsystemOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './CommandPalette.module.css'

/** 命令面板开关的全局事件（首页按钮与键盘共用）。 */
export const PALETTE_TOGGLE_EVENT = 'omnagent:command-palette:toggle'

export interface CommandPaletteInjected {
  /** 新建会话（ui-workspace 服务）。 */
  startSession: () => void
  /** 主面板导航（ui-layout 服务）。 */
  selectPanel: (panelId: string | null) => void
  /** 主题切换（ui-theme 服务）。 */
  setTheme: (id: 'light' | 'dark' | 'system') => void
}

export type CommandPaletteProps =
  PropsLocale<'commandPalette'>
  & CommandPaletteInjected

interface PaletteAction {
  id: string
  label: string
  desc?: string
  icon: ReactNode
  run: () => void
}

function CommandPaletteInner({ t, startSession, selectPanel, setTheme }: {
  t: PropsLocale<'commandPalette'>['t']
} & CommandPaletteInjected) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const actions = useMemo<PaletteAction[]>(() => [
    {
      id: 'new-session', label: t('newSession'), desc: t('newSessionDesc'),
      icon: <IconNewChatOutlineRegular size={16} />,
      run: () => { startSession() },
    },
    {
      id: 'plugins', label: t('plugins'), desc: t('pluginsDesc'),
      icon: <IconPluginPinwheelOutlineRegular size={16} />,
      run: () => { selectPanel('plugins') },
    },
    {
      id: 'back-to-chat', label: t('backToChat'), desc: t('backToChatDesc'),
      icon: <IconSendOutlineRegular size={16} />,
      run: () => { selectPanel(null) },
    },
    {
      id: 'theme-light', label: t('themeLight'), desc: t('themeDesc'),
      icon: <IconLightOutlineRegular size={16} />,
      run: () => { setTheme('light') },
    },
    {
      id: 'theme-dark', label: t('themeDark'), desc: t('themeDesc'),
      icon: <IconDarkOutlineRegular size={16} />,
      run: () => { setTheme('dark') },
    },
    {
      id: 'theme-system', label: t('themeSystem'), desc: t('themeDesc'),
      icon: <IconFollowsystemOutlineRegular size={16} />,
      run: () => { setTheme('system') },
    },
  ], [t, startSession, selectPanel, setTheme])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return actions
    return actions.filter(a => `${a.label} ${a.desc ?? ''}`.toLowerCase().includes(q))
  }, [actions, query])

  // 键盘开关（Ctrl/Cmd+K）与全局事件开关（首页按钮）。
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(v => !v)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    const onToggle = (): void => { setOpen(v => !v) }
    window.addEventListener('keydown', onKey)
    window.addEventListener(PALETTE_TOGGLE_EVENT, onToggle)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(PALETTE_TOGGLE_EVENT, onToggle)
    }
  }, [])

  // 打开时重置查询与选中项、聚焦输入框。
  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const run = (action: PaletteAction | undefined): void => {
    if (!action) return
    setOpen(false)
    action.run()
  }

  const onKeyDown = (e: ReactKeyboardEvent): void => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); run(filtered[index]) }
  }

  if (!open) return null
  return (
    <div className={css.backdrop} onMouseDown={() => setOpen(false)}>
      <div className={css.panel} role="dialog" aria-modal="true" aria-label={t('open')} onMouseDown={e => e.stopPropagation()}>
        <div className={css.inputRow}>
          <IconSearchOutlineRegular className={css.searchIcon} size={16} />
          <input
            ref={inputRef}
            className={css.input}
            placeholder={t('placeholder')}
            value={query}
            onChange={e => { setQuery(e.target.value); setIndex(0) }}
            onKeyDown={onKeyDown}
          />
          <span className={css.kbd}>{t('kbd')}</span>
        </div>
        <div className={css.list}>
          {filtered.length === 0 && <div className={css.empty}>{t('placeholder')}</div>}
          {filtered.map((action, i) => (
            <button
              key={action.id}
              type="button"
              className={`${css.item}${i === index ? ` ${css.itemActive}` : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(action)}
            >
              <span className={css.itemIcon}>{action.icon}</span>
              <span className={css.itemText}>
                <span className={css.itemLabel}>{action.label}</span>
                {action.desc && <span className={css.itemDesc}>{action.desc}</span>}
              </span>
            </button>
          ))}
        </div>
        <div className={css.footer}>{t('hint')}</div>
      </div>
    </div>
  )
}

/** Shell.overlay 槽位组件：始终挂载、按需显隐。 */
export function CommandPalette({ t, startSession, selectPanel, setTheme }: CommandPaletteProps) {
  return (
    <CommandPaletteInner
      t={t}
      startSession={startSession}
      selectPanel={selectPanel}
      setTheme={setTheme}
    />
  )
}

// eslint-disable-next-line -- 类型仅为编译期契约
export type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
