import type { JSX } from 'react'

export type IconName =
  | 'zoom-in'
  | 'zoom-out'
  | 'fit'
  | 'undo'
  | 'redo'
  | 'rotate'
  | 'flip'
  | 'note'
  | 'duplicate'
  | 'trash'
  | 'close'
  | 'chevron'

const PATHS: Record<IconName, JSX.Element> = {
  'zoom-in': (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.6 10.6 14 14" />
      <path d="M5 7h4M7 5v4" />
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.6 10.6 14 14" />
      <path d="M5 7h4" />
    </>
  ),
  fit: (
    <>
      <path d="M2 6V3a1 1 0 0 1 1-1h3" />
      <path d="M14 6V3a1 1 0 0 0-1-1h-3" />
      <path d="M2 10v3a1 1 0 0 0 1 1h3" />
      <path d="M14 10v3a1 1 0 0 1-1 1h-3" />
    </>
  ),
  undo: (
    <>
      <path d="M4 7h7.5a3.5 3.5 0 0 1 0 7H8" />
      <path d="M7 3 3.5 7 7 11" />
    </>
  ),
  redo: (
    <>
      <path d="M12 7H4.5a3.5 3.5 0 0 0 0 7H8" />
      <path d="M9 3l3.5 4L9 11" />
    </>
  ),
  rotate: (
    <>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.7-4" />
      <path d="M13.5 2.5V6H10" />
    </>
  ),
  flip: (
    <>
      <path d="M8 2v12" />
      <path d="M5.5 4.5 2 8l3.5 3.5z" />
      <path d="M10.5 4.5 14 8l-3.5 3.5z" />
    </>
  ),
  note: (
    <>
      <path d="M3 3.5h9.5v6.2L9 13.5H3z" />
      <path d="M9 13.5V9.7h3.5" />
    </>
  ),
  duplicate: (
    <>
      <rect x="2" y="2" width="8.5" height="8.5" rx="1.5" />
      <rect x="5.5" y="5.5" width="8.5" height="8.5" rx="1.5" />
    </>
  ),
  trash: (
    <>
      <path d="M2.5 4.5h11" />
      <path d="M6 4.5V2.8h4v1.7" />
      <path d="M4.5 4.5 5 13.2h6l.5-8.7" />
      <path d="M6.8 7v4M9.2 7v4" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  chevron: <path d="M4 6l4 4 4-4" />,
}

/** Offline, font-independent icon set (system fonts lack many symbol glyphs). */
export function Icon({ name }: { readonly name: IconName }): JSX.Element {
  return (
    <svg
      className="cb-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}
