// The composer remains in ConversationRoot so switching out of the blank-draft
// phase does not remount its textarea.

import { useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  FISH_LOGO_PATH, FISH_LOGO_VIEWBOX, IconChevronDownOutlineRegular, IconFolderCloseRegular, IconFolderOpenRegular,
} from '@deepseek-ai/dsh-client-ui-primitives'
import { workspaceTitleOf } from '@deepseek-ai/dsh-util-workspace-path'
import type { ConversationContentProps } from '../contract/slots.ts'
import css from './HeroShell.module.css'

/** The owner's locale seat type, passed to hero chrome as a plain prop. */
type HeroTranslate = ConversationContentProps['t']

/**
 * Basename label for the workspace chip (the shared derivation);
 * separator-only paths echo the raw cwd.
 * @param cwd - workspace directory path (non-empty).
 * @returns chip label.
 */
export function workspaceLabel(cwd: string): string {
  const base = workspaceTitleOf(cwd)
  return base !== '' ? base : cwd
}

/**
 * The workspace chip (folder + label + chevron), always interactive: before
 * the first message the workspace stays switchable — picking another one
 * moves the New Session flow to that workspace's blank session. Without a
 * label the chip renders its placeholder state: closed folder + the
 * "Choose workspace" call to action.
 * @param props.label - chip label (see {@link workspaceLabel}); omitted → placeholder.
 * @param props.menuOpen - menu expansion echo.
 * @param props.onClick - menu toggle.
 * @returns the chip button element.
 */
export function WorkspaceChip({ buttonRef, label, menuOpen = false, onClick, t }: {
  buttonRef?: RefObject<HTMLButtonElement>
  label?: string | undefined
  menuOpen?: boolean
  onClick?: () => void
  t: HeroTranslate
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={css.workspace}
      aria-label={t('hero.chooseWorkspace')}
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      onClick={onClick}
    >
      {label === undefined
        ? <IconFolderCloseRegular className={css.folder} size={16} />
        : <IconFolderOpenRegular className={css.folder} size={16} />}
      <span className={css.workspaceLabel}>{label ?? t('hero.chooseWorkspace')}</span>
      <IconChevronDownOutlineRegular className={css.chevron} size={12} />
    </button>
  )
}

/** Hero chrome props. The workspace row rides the InputBar accessory hole, not here. */
export interface HeroShellProps {
  /** The owner's locale seat, passed down as a plain prop. */
  t: HeroTranslate
  /** Authorized renderer for the hero brand-mark slot. */
  renderSlot: ConversationContentProps['renderSlot']
  /** Overlay content after the stack (modals). */
  children?: ReactNode
}

/**
 * The hero mark (34px wide), static at rest. Hovering gives it a small
 * spin-and-lift so the orbit reads as alive; the transform is CSS-driven so
 * reduced-motion users keep the static mark. Decorative — hidden from the
 * accessibility tree.
 * @param props.hovering - driven by the hitbox parent's pointer state.
 * @returns the mark svg element.
 */
function HeroFish({ hovering }: { hovering: boolean }) {
  return (
    <svg
      className={css.mark}
      width={34}
      height={(34 * FISH_LOGO_VIEWBOX.height) / FISH_LOGO_VIEWBOX.width}
      viewBox={`0 0 ${FISH_LOGO_VIEWBOX.width} ${FISH_LOGO_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
      style={{
        transform: hovering ? 'rotate(-7deg) translateY(-1px)' : 'none',
        transformOrigin: '50% 50%',
        transition: 'transform 0.45s cubic-bezier(0.45, 0, 0.55, 1)',
      }}
    >
      <path d={FISH_LOGO_PATH} fill="currentColor" />
    </svg>
  )
}

/**
 * OmniAgent 特色区域：万物皆可插件的三张能力卡（可被 conversation.hero.showcase
 * 槽位覆盖）。静态展示，保持与品牌定位一致的引导文案。
 */
function Showcase({ t }: { t: HeroTranslate }) {
  const cards = [
    { tag: t('hero.card1.tag'), title: t('hero.card1.title'), desc: t('hero.card1.desc') },
    { tag: t('hero.card2.tag'), title: t('hero.card2.title'), desc: t('hero.card2.desc') },
    { tag: t('hero.card3.tag'), title: t('hero.card3.title'), desc: t('hero.card3.desc') },
  ]
  return (
    <div className={css.showcase}>
      <p className={css.tagline}>{t('hero.tagline')}</p>
      <div className={css.cardGrid}>
        {cards.map(card => (
          <div key={card.tag} className={css.card}>
            <span className={css.cardTag}>{card.tag}</span>
            <span className={css.cardTitle}>{card.title}</span>
            <span className={css.cardDesc}>{card.desc}</span>
          </div>
        ))}
      </div>
      {/* 快速命令入口：打开全局命令面板（Ctrl/⌘+K 同效）。 */}
      <button
        type="button"
        className={css.paletteButton}
        onClick={() => { window.dispatchEvent(new Event('omnagent:command-palette:toggle')) }}
      >
        <span className={css.paletteButtonLabel}>{t('hero.openPalette')}</span>
        <span className={css.paletteKbd}>{t('hero.openPaletteHint')}</span>
      </button>
    </div>
  )
}

/**
 * Render the hero chrome (headline only; no composer, no workspace row).
 * @param props - see {@link HeroShellProps}.
 * @returns the centered hero element tree.
 */
export function HeroShell({ t, renderSlot, children }: HeroShellProps) {
  const [hovering, setHovering] = useState(false)
  return (
    <div className={css.root}>
      <div className={css.stack}>
        <div className={css.headline}>
          {/* figma 34:10412: mark 34×25 leading the headline, gap 10. */}
          <span
            className={css.markHitbox}
            onMouseEnter={() => {
              if (window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
                setHovering(true)
              }
            }}
            onMouseLeave={() => { setHovering(false) }}
          >
            {renderSlot('conversation.hero.brand.mark', { size: 34, className: css.mark }, {
              fallback: <HeroFish hovering={hovering} />,
            })}
          </span>
          <span className={css.titleGroup}>
            {/* Own element: keeps the headline text addressable apart from the badge. */}
            <span className={css.gradientTitle}>{t('hero.headline')}</span>
            <span className={css.previewBadge}>{t('hero.preview')}</span>
          </span>
        </div>
        <div className={css.body}>
          {/* OmniAgent 特色区域：品牌 tagline + 能力卡（可被槽位覆盖）。 */}
          {renderSlot('conversation.hero.showcase', {}, { fallback: <Showcase t={t} /> })}
          {/* The composer remains mounted outside this component. */}
        </div>
      </div>
      {children}
    </div>
  )
}
