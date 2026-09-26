import type { IconProps } from './icons/props.ts'

/** Native viewBox of {@link FISH_LOGO_PATH} (width and height in user units). */
export const FISH_LOGO_VIEWBOX = { width: 24, height: 18 }

/** The OmniAgent mark: an orbit ring around a four-point star, with two companion stars. Exported for consumers that compose their own svg (entrance effects, masks) around the same geometry. */
export const FISH_LOGO_PATH = 'M8.6 1.8C12.576 1.8 15.8 5.024 15.8 9C15.8 12.976 12.576 16.2 8.6 16.2C4.624 16.2 1.4 12.976 1.4 9C1.4 5.024 4.624 1.8 8.6 1.8ZM8.6 3.5C5.562 3.5 3.1 5.962 3.1 9C3.1 12.038 5.562 14.5 8.6 14.5C11.638 14.5 14.1 12.038 14.1 9C14.1 5.962 11.638 3.5 8.6 3.5ZM8.6 5C9.484 8.116 9.484 8.116 12.6 9C9.484 9.884 9.484 9.884 8.6 13C7.716 9.884 7.716 9.884 4.6 9C7.716 8.116 7.716 8.116 8.6 5ZM19.2 2.1C19.73 4.07 19.73 4.07 21.7 4.6C19.73 5.13 19.73 5.13 19.2 7.1C18.67 5.13 18.67 5.13 16.7 4.6C18.67 4.07 18.67 4.07 19.2 2.1ZM20.6 11.1C20.918 12.282 20.918 12.282 22.1 12.6C20.918 12.918 20.918 12.918 20.6 14.1C20.282 12.918 20.282 12.918 19.1 12.6C20.282 12.282 20.282 12.282 20.6 11.1Z'

/**
 * Render the OmniAgent mark.
 * @param props.size - width in px (default 24; height keeps the 24:18 ratio).
 * @param props.className - extra class for layout placement.
 * @returns the mark svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={(size * FISH_LOGO_VIEWBOX.height) / FISH_LOGO_VIEWBOX.width}
      className={className}
      viewBox={`0 0 ${FISH_LOGO_VIEWBOX.width} ${FISH_LOGO_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={FISH_LOGO_PATH} fill="currentColor" />
    </svg>
  )
}
