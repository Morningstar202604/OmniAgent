// The composer remains in ConversationRoot so switching out of the blank-draft
// phase does not remount its textarea.

import { useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  IconChevronDownOutlineRegular, IconFolderCloseRegular, IconFolderOpenRegular,
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
 * The OmniAgent hero mark (34px): a rounded dark tile with three cyan
 * horizontals and an amber dot — the same geometry as the product favicon.
 * On hover the horizontals sweep in left-to-right in sequence and the dot
 * breathes, a restrained nod to the classic swim animation. Decorative —
 * hidden from the accessibility tree; reduced motion keeps the static tile
 * (sampled at mouseenter; a mid-hover preference change takes effect on the
 * next enter).
 * @param props.hovering - driven by the hitbox parent's pointer state.
 * @returns the mark svg element.
 */
function OmniAgentMark({ hovering }: { hovering: boolean }) {
  return (
    <svg
      className={css.fish}
      width={34}
      height={34}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <rect x="0.5" y="0.5" width="31" height="31" rx="7" fill="#0d1117" stroke="#1c232e" />
      <g stroke="#22d3ee" strokeWidth="3" strokeLinecap="round">
        <line x1="8" y1="10" x2="24" y2="10">
          {hovering && <animate attributeName="x2" values="8;24;24;8;8" keyTimes="0;0.3;0.6;0.85;1" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" />}
        </line>
        <line x1="8" y1="16" x2="24" y2="16">
          {hovering && <animate attributeName="x2" values="8;24;24;8;8" keyTimes="0;0.35;0.6;0.85;1" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" />}
        </line>
        <line x1="8" y1="22" x2="24" y2="22">
          {hovering && <animate attributeName="x2" values="8;24;24;8;8" keyTimes="0;0.4;0.6;0.85;1" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" />}
        </line>
      </g>
      <circle cx="24" cy="16" r="2.4" fill="#fbbf24">
        {hovering && <animate attributeName="r" values="2.4;3.1;2.4;2.4;2.4" keyTimes="0;0.5;0.8;1;1" dur="1.6s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1;0.45 0 0.55 1" />}
      </circle>
    </svg>
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
          {/* OmniAgent mark 34×34 leading the headline, gap 10. */}
          <span
            className={css.fishHitbox}
            onMouseEnter={() => {
              if (window.matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
                setHovering(true)
              }
            }}
            onMouseLeave={() => { setHovering(false) }}
          >
            {renderSlot('conversation.hero.brand.mark', { size: 34, className: css.fish }, {
              fallback: <OmniAgentMark hovering={hovering} />,
            })}
          </span>
          <span className={css.titleGroup}>
            {/* Own element: keeps the headline text addressable apart from the badge. */}
            <span>{t('hero.headline')}</span>
            <span className={css.previewBadge}>{t('hero.preview')}</span>
          </span>
        </div>
        <div className={css.body}>
          {/* The composer remains mounted outside this component. */}
        </div>
      </div>
      {children}
    </div>
  )
}
