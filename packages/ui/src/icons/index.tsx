import type { ReactNode } from 'react';

/** Original icon set — 20 px grid, 1.5 px stroke, currentColor (see docs/DESIGN.md 3.4). */

export type IconProps = { size?: number };

function icon(children: ReactNode) {
  return function Icon({ size = 20 }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {children}
      </svg>
    );
  };
}

export const SelectIcon = icon(<path d="M4 3l6 13 2-5 5-2z" />);
export const WireIcon = icon(<path d="M3 10h6a3 3 0 0 1 3 3v4M3 10a3 3 0 0 1 3-3h5" />);
export const RotateIcon = icon(
  <>
    <path d="M15 6a6 6 0 1 0 1.5 4" />
    <path d="M16 3v3.5h-3.5" />
  </>,
);
export const DuplicateIcon = icon(
  <>
    <rect x="7" y="7" width="9" height="9" rx="1.5" />
    <path d="M4 12V5.5A1.5 1.5 0 0 1 5.5 4H12" />
  </>,
);
export const DeleteIcon = icon(
  <>
    <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
  </>,
);
export const UndoIcon = icon(
  <>
    <path d="M7 7H4v-3" />
    <path d="M4 7a6 6 0 1 1 2 8" />
  </>,
);
export const RedoIcon = icon(
  <>
    <path d="M13 7h3v-3" />
    <path d="M16 7a6 6 0 1 0-2 8" />
  </>,
);
export const GridIcon = icon(<path d="M4 4h12v12H4zM4 9.3h12M9.3 4v12" />);
export const ZoomInIcon = icon(
  <>
    <circle cx="9" cy="9" r="5" />
    <path d="M13 13l4 4M9 7v4M7 9h4" />
  </>,
);
export const ZoomOutIcon = icon(
  <>
    <circle cx="9" cy="9" r="5" />
    <path d="M13 13l4 4M7 9h4" />
  </>,
);
export const ZoomFitIcon = icon(
  <>
    <path d="M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4" />
  </>,
);
export const RunIcon = icon(<path d="M6 4l9 6-9 6z" />);
export const PauseIcon = icon(
  <>
    <path d="M7 5v10M13 5v10" />
  </>,
);
export const StopIcon = icon(<rect x="6" y="6" width="8" height="8" rx="1" />);
export const CodeIcon = icon(
  <>
    <path d="M8 5l-4 5 4 5M12 5l4 5-4 5" />
  </>,
);
export const BlocksIcon = icon(
  <>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="10" y="10" width="6" height="6" rx="1" />
  </>,
);
export const SerialIcon = icon(<path d="M4 6h12v8H4zM7 10l1.5 1.5L11 9" />);
export const ScopeIcon = icon(<path d="M4 11l3-5 3 7 3-8 3 6" />);
export const SchematicIcon = icon(
  <>
    <path d="M5 7h4l2 3 4 0" />
    <circle cx="5" cy="7" r="1.5" />
    <circle cx="15" cy="10" r="1.5" />
  </>,
);
export const NewIcon = icon(
  <>
    <path d="M6 3h5l3 3v11H6z" />
    <path d="M11 3v3h3" />
  </>,
);
export const OpenIcon = icon(<path d="M3 6h5l1.5 2H17v8H3z" />);
export const SaveIcon = icon(
  <>
    <path d="M4 4h9l3 3v9H4z" />
    <path d="M7 4v4h6V4M7 16v-4h6v4" />
  </>,
);
export const ExportIcon = icon(
  <>
    <path d="M10 3v8M7 8l3 3 3-3" />
    <path d="M4 13v3h12v-3" />
  </>,
);
export const PanelLeftIcon = icon(
  <>
    <rect x="3" y="4" width="14" height="12" rx="1.5" />
    <path d="M8 4v12" />
  </>,
);
export const PanelRightIcon = icon(
  <>
    <rect x="3" y="4" width="14" height="12" rx="1.5" />
    <path d="M12 4v12" />
  </>,
);
export const ThemeIcon = icon(<path d="M13 3a7 7 0 1 0 4 12A6 6 0 0 1 13 3z" />);
export const NetsIcon = icon(
  <>
    <circle cx="5" cy="5" r="1.5" />
    <circle cx="15" cy="8" r="1.5" />
    <circle cx="7" cy="15" r="1.5" />
    <path d="M6 6l8 1.5M6.5 6.5L7 13" />
  </>,
);

export const CategoryPassiveIcon = icon(<path d="M2 10h3l1.5-3 2 6 2-6 1.5 3h4" />);
export const CategoryOptoIcon = icon(
  <>
    <circle cx="10" cy="11" r="4" />
    <path d="M6 4l2 3M14 4l-2 3M3.5 10l2.5 1M16.5 10l-2.5 1" />
  </>,
);
export const CategoryPowerIcon = icon(
  <>
    <rect x="5" y="7" width="10" height="6" rx="1" />
    <path d="M3 9h2v2H3M17 9h2v2h-2" />
  </>,
);
export const CategoryDigitalIcon = icon(
  <>
    <path d="M4 5v10M4 10h3" />
    <path d="M7 7h4a3 3 0 0 1 0 6H7z" />
    <path d="M14 10h3" />
  </>,
);
export const CategoryMcuIcon = icon(
  <>
    <rect x="6" y="6" width="8" height="8" rx="1.5" />
    <path d="M9 3v3M11 3v3M9 14v3M11 14v3M3 9h3M3 11h3M14 9h3M14 11h3" />
  </>,
);
export const CategoryInstrumentIcon = icon(<path d="M4 11l3-5 3 7 3-8 3 6" />);

export const ICONS = {
  select: SelectIcon,
  wire: WireIcon,
  rotate: RotateIcon,
  duplicate: DuplicateIcon,
  delete: DeleteIcon,
  undo: UndoIcon,
  redo: RedoIcon,
  grid: GridIcon,
  zoomIn: ZoomInIcon,
  zoomOut: ZoomOutIcon,
  zoomFit: ZoomFitIcon,
  run: RunIcon,
  pause: PauseIcon,
  stop: StopIcon,
  code: CodeIcon,
  blocks: BlocksIcon,
  serial: SerialIcon,
  scope: ScopeIcon,
  schematic: SchematicIcon,
  new: NewIcon,
  open: OpenIcon,
  save: SaveIcon,
  export: ExportIcon,
  panelLeft: PanelLeftIcon,
  panelRight: PanelRightIcon,
  theme: ThemeIcon,
  nets: NetsIcon,
  categoryPassive: CategoryPassiveIcon,
  categoryOpto: CategoryOptoIcon,
  categoryPower: CategoryPowerIcon,
  categoryDigital: CategoryDigitalIcon,
  categoryMcu: CategoryMcuIcon,
  categoryInstrument: CategoryInstrumentIcon,
} as const;

export type IconName = keyof typeof ICONS;

export const CATEGORY_ICONS: Record<string, IconName> = {
  passive: 'categoryPassive',
  opto: 'categoryOpto',
  power: 'categoryPower',
  digital: 'categoryDigital',
  mcu: 'categoryMcu',
  instrument: 'categoryInstrument',
};
