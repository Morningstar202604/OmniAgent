import type { IconProps } from './icons/props.ts'
import { FISH_LOGO_PATH, FISH_LOGO_VIEWBOX } from './FishLogo.tsx'

/** Display options for the official brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading mark; defaults to true. */
  includeMark?: boolean | undefined
}

/** Font stack for the wordmark; the app ships Montserrat as its brand face. */
const WORDMARK_FONT = "Montserrat, 'Segoe UI', system-ui, -apple-system, sans-serif"

/** Text width in user units at the 24-unit height; locked so layout never depends on the resolved font. */
const WORDMARK_TEXT_WIDTH = 96

/**
 * Render the full brand wordmark (mark plus name).
 * @param props.size - height in px (default 24; width follows the selected artwork).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading mark.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const markScale = 24 / FISH_LOGO_VIEWBOX.height
  const width = includeMark ? 136 : 100
  return (
    <svg
      width={size}
      height={(size * width) / 24}
      className={className}
      viewBox={includeMark ? '0 0 136 24' : '36 0 100 24'}
      fill="none"
      aria-hidden="true"
    >
      {includeMark && (
        <g transform={`translate(0 3) scale(${markScale})`}>
          <path d={FISH_LOGO_PATH} fill="currentColor" />
        </g>
      )}
      <text
        x={40}
        y={17.5}
        fontFamily={WORDMARK_FONT}
        fontSize={17}
        fontWeight={600}
        fill="currentColor"
        textLength={WORDMARK_TEXT_WIDTH}
        lengthAdjust="spacing"
      >
        OmniAgent
      </text>
    </svg>
  )
}
