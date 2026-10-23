import {
  startTransition,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react'
import { APP_NAME } from '../../shared/app'
import type { CircuitDocument } from '../../shared/circuit'
import { registerPdfCapture } from '../export/pdfCapture'
import { registerPngCapture } from '../export/pngCapture'
import { svgToPdfBase64 } from '../export/svgPdf'
import { rasterizeSvgToPng } from '../export/svgPng'
import { definitionOf } from '../parts/definitions'
import { Icon } from '../ui/Icon'
import { useCircuitStore } from '../store/circuitStore'
import { useProjectStore } from '../store/projectStore'
import {
  fitSchematicToPaper,
  layoutSchematicPages,
  PAPER_PRESETS,
  type SchematicPagination,
  type SchematicPaper,
  type SchematicPartNode,
} from './layout'

type SchematicMode = 'simplified' | 'original'

const MODE_STORAGE_KEY = 'vircuitcad.schematicMode'
const PAPER_STORAGE_KEY = 'vircuitcad.schematicPaper'

function readStoredMode(): SchematicMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'original' ? 'original' : 'simplified'
  } catch {
    return 'simplified'
  }
}

function readStoredPaper(): SchematicPaper {
  try {
    const value = localStorage.getItem(PAPER_STORAGE_KEY)
    return value === 'letter' || value === 'legal' ? value : 'a4'
  } catch {
    return 'a4'
  }
}

/** Truncates on-screen labels that would otherwise leave their symbol box. */
function fittedLabel(text: string, width: number, fontSize: number): string {
  const maxCharacters = Math.max(4, Math.floor((width - 20) / (fontSize * 0.6)))
  return text.length <= maxCharacters ? text : `${text.slice(0, maxCharacters - 1)}…`
}

/** Symbol artwork shared by the compact cards and the engineering sheet. */
function GlyphBody({
  type,
  vertical = false,
}: {
  readonly type: SchematicPartNode['type']
  readonly vertical?: boolean
}): JSX.Element | null {
  switch (type) {
    case 'resistor':
    case 'potentiometer':
    case 'ldr': {
      const zigzag = (
        <path d="M -34 0 H -28 L -22 -10 L -14 10 L -6 -10 L 2 10 L 10 -10 L 16 0 H 22 M 22 0 H 34" />
      )
      if (type === 'potentiometer') {
        return (
          <>
            {zigzag}
            <path d="M 0 -24 V -8" />
            <path className="cb-sch-glyph-fill" d="M -4 -10 L 4 -10 L 0 -4 Z" />
          </>
        )
      }
      if (type === 'ldr') {
        return (
          <>
            {zigzag}
            <path d="M -26 -26 L -14 -14 M -14 -26 L -2 -14" />
            <path className="cb-sch-glyph-fill" d="M -14 -14 L -20 -12 L -16 -20 Z" />
            <path className="cb-sch-glyph-fill" d="M -2 -14 L -8 -12 L -4 -20 Z" />
          </>
        )
      }
      return zigzag
    }
    case 'led':
    case 'diode':
    case 'rgb-led':
      return (
        <>
          <path d="M -34 0 H -8" />
          <path className="cb-sch-glyph-fill" d="M -8 10 L -8 -10 L 10 0 Z" />
          <path d="M 10 -12 V 12 M 10 0 H 34" />
          <path d="M 0 -14 L 10 -24 M 8 -10 L 18 -20" />
          <path className="cb-sch-glyph-fill" d="M 10 -24 L 4 -22 L 8 -18 Z" />
          <path className="cb-sch-glyph-fill" d="M 18 -20 L 12 -18 L 16 -14 Z" />
          {type === 'rgb-led' ? (
            <>
              <path d="M -2 14 L 8 24 M 6 10 L 16 20" />
              <path className="cb-sch-glyph-fill" d="M 8 24 L 2 22 L 6 18 Z" />
              <path className="cb-sch-glyph-fill" d="M 16 20 L 10 18 L 14 14 Z" />
            </>
          ) : null}
        </>
      )
    case 'capacitor':
      return (
        <>
          <path d="M -34 0 H -6 M 6 0 H 34" />
          <path d="M -6 -14 V 14 M 6 -14 V 14" />
        </>
      )
    case 'battery-aa':
      return (
        <>
          <path d="M -34 0 H -8 M 8 0 H 34" />
          <path d="M -8 -14 V 14 M 0 -8 V 8" />
        </>
      )
    case 'battery-9v':
      return (
        <>
          <path d="M -34 0 H -16 M 20 0 H 34" />
          <path d="M -16 -14 V 14 M -8 -8 V 8 M 8 -14 V 14 M 16 -8 V 8" />
        </>
      )
    case 'inductor':
      return (
        <>
          <path d="M -34 0 H -28" />
          <path d="M -28 0 q 8 -18 16 0 q 8 -18 16 0 q 8 -18 16 0" />
          <path d="M 20 0 H 34" />
        </>
      )
    case 'buzzer':
      return (
        <>
          <path d="M -34 0 H -12" />
          <path d="M -12 -14 A 14 14 0 0 1 -12 14 Z" />
          <path d="M -12 0 H 18 M 18 0 H 34" />
          <path d="M 22 -10 q 7 10 0 20" />
        </>
      )
    case 'push-button':
      return (
        <>
          <path d="M -34 0 H -10 M 10 0 H 34" />
          <circle cx={-10} cy={0} r={3} />
          <circle cx={10} cy={0} r={3} />
          <path d="M -14 -8 H 14 M 0 -8 V -18" />
        </>
      )
    case 'slide-switch':
      return (
        <>
          <path d="M -34 0 H -12 M 12 0 H 34" />
          <circle cx={-12} cy={0} r={3} />
          <circle cx={12} cy={0} r={3} />
          <path d="M -12 0 L 10 -14" />
          <circle cx={10} cy={-14} r={3} />
        </>
      )
    case 'seven-segment':
      return (
        <>
          <rect x={-20} y={-24} width={40} height={48} rx={4} />
          <text className="cb-sch-glyph-text" x={0} y={6} textAnchor="middle">
            8
          </text>
        </>
      )
    case 'power-supply':
      return (
        <>
          <circle cx={0} cy={0} r={18} />
          <path d="M -7 0 H 7 M 0 -7 V 7" />
        </>
      )

    case 'electrolytic-capacitor':
      return (
        <>
          <path d="M -34 0 H -6 M 6 0 H 34" />
          <path d="M -6 -14 V 14" />
          <path d="M 6 -14 V 14 M 12 -18 H 20 M 16 -22 V -14" />
        </>
      )
    case 'zener-diode':
      return (
        <>
          <path d="M -34 0 H -8" />
          <path className="cb-sch-glyph-fill" d="M -8 10 L -8 -10 L 10 0 Z" />
          <path d="M 10 -14 V 12 M 6 -10 L 10 -14 L 14 -10 M 10 0 H 34" />
        </>
      )
    case 'light-bulb':
      return (
        <>
          <path d="M -34 0 H -14 M 14 0 H 34" />
          <circle cx={0} cy={0} r={14} />
          <path d="M -8 -8 L 8 8 M 8 -8 L -8 8" />
        </>
      )
    case 'vibration-motor':
    case 'gear-motor':
    case 'dc-motor':
      return (
        <>
          <circle cx={0} cy={0} r={18} />
          <text
            className="cb-sch-glyph-text"
            x={0}
            y={4}
            textAnchor="middle"
            transform={vertical ? 'rotate(-90)' : undefined}
          >
            {type === 'gear-motor' ? 'G' : type === 'vibration-motor' ? 'V' : 'M'}
          </text>
        </>
      )
    case 'thermistor':
      return (
        <>
          <path d="M -34 0 H -24 L -18 -10 L -10 10 L -2 -10 L 6 10 L 12 0 H 24 M 24 0 H 34" />
          <path d="M -8 -22 L 12 -2 M -8 -22 L -8 -16 M -8 -22 L -2 -22" />
          <text className="cb-sch-glyph-text" x={-10} y={-22} textAnchor="middle">
            θ
          </text>
        </>
      )
    case 'flex-sensor':
      return (
        <>
          <path d="M -34 0 H -24" />
          <path d="M -24 0 q 12 -20 24 0 q 12 20 24 0" />
          <path d="M 24 0 H 34" />
          <path d="M -18 -6 L -22 -12 M 18 -6 L 22 -12" />
        </>
      )
    case 'force-sensor':
      return (
        <>
          <path d="M -34 0 H -20 L -14 -10 L -6 10 L 2 -10 L 10 10 L 16 0 H 20 M 20 0 H 34" />
          <path d="M 0 -26 V -16 M -6 -22 L 0 -16 L 6 -22" />
        </>
      )
    case 'photodiode':
      return (
        <>
          <path d="M -34 0 H -8" />
          <path className="cb-sch-glyph-fill" d="M -8 10 L -8 -10 L 10 0 Z" />
          <path d="M 10 -12 V 12 M 10 0 H 34" />
          <path d="M -2 -18 L 8 -8 M -8 -22 L 2 -12 M 4 -14 L 10 -20" />
        </>
      )
    case 'phototransistor':
      return (
        <>
          <path d="M -34 0 H -14 M -14 0 V -12 M 14 0 H 34 M 14 0 V 12" />
          <path d="M -14 -8 L 8 0 L -14 8 Z" />
          <path d="M 8 0 L 14 12" />
          <path d="M -8 -20 L 4 -10 M -2 -24 L 10 -14 M 8 -14 L 14 -20" />
        </>
      )
    case 'tilt-sensor':
      return (
        <>
          <path d="M -34 0 H -14 M 14 0 H 34" />
          <circle cx={-14} cy={0} r={3} />
          <circle cx={14} cy={0} r={3} />
          <path d="M -14 0 L 10 -12" />
          <circle cx={10} cy={-12} r={4} />
        </>
      )
    case 'soil-moisture':
      return (
        <>
          <path d="M -34 0 H -24 L -18 -10 L -10 10 L -2 -10 L 6 10 L 12 0 H 22 M 22 0 H 34" />
          <path d="M 0 -24 q 8 8 0 14 q -8 -6 0 -14 Z" />
        </>
      )
    case 'gas-sensor':
      return (
        <>
          <circle cx={0} cy={0} r={18} />
          <text className="cb-sch-glyph-text" x={0} y={4} textAnchor="middle">
            G
          </text>
          <path d="M -26 0 H -18 M 18 0 H 26" />
        </>
      )
    case 'tmp36':
      return (
        <>
          <rect x={-16} y={-18} width={32} height={36} rx={4} />
          <text className="cb-sch-glyph-text" x={0} y={4} textAnchor="middle">
            T
          </text>
        </>
      )
    case 'coin-cell':
    case 'solar-cell':
    case 'potato-battery':
      return (
        <>
          <path d="M -34 0 H -8 M 8 0 H 34" />
          <path d="M -8 -14 V 14 M 0 -8 V 8" />
          <text className="cb-sch-glyph-text" x={0} y={-22} textAnchor="middle">
            {type === 'coin-cell' ? '3V' : type === 'solar-cell' ? 'PV' : '0.9V'}
          </text>
        </>
      )
    case 'dip-switch-4':
    case 'dip-switch-6':
      return (
        <>
          <path d="M -34 0 H -20 M 20 0 H 34" />
          <rect x={-20} y={-14} width={40} height={28} rx={3} />
          {[0, 1, 2, 3].map((index) => (
            <path key={index} d={`M ${-12 + index * 8} -6 V 6`} />
          ))}
        </>
      )
    case 'lm7805':
    case 'ld1117v33':
      return (
        <>
          <path d="M -34 0 H -18 M 18 0 H 34" />
          <rect x={-18} y={-16} width={36} height={32} rx={3} />
          <text className="cb-sch-glyph-text" x={0} y={4} textAnchor="middle">
            {type === 'lm7805' ? '5V' : '3V3'}
          </text>
        </>
      )
    default:
      return (
        <>
          <rect x={-24} y={-18} width={48} height={36} rx={3} />
          <text className="cb-sch-glyph-text" x={0} y={4} textAnchor="middle">
            {type.split('-')[0]?.slice(0, 4).toUpperCase()}
          </text>
        </>
      )
  }
}

function GlyphFor({ node }: { readonly node: SchematicPartNode }): JSX.Element | null {
  if (node.board) return null

  const body = <GlyphBody type={node.type} />
  if (body === null) return null

  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2

  return (
    <g className="cb-sch-glyph" transform={`translate(${cx} ${cy})`} aria-hidden="true">
      <title>{node.type.replace(/-/g, ' ')}</title>
      {body}
    </g>
  )
}

function twoPinMark(label: string): string | null {
  const normalized = label.toLowerCase()
  if (normalized === 'anode') return 'A'
  if (normalized === 'cathode') return 'K'
  if (normalized === 'positive') return '+'
  if (normalized === 'negative') return '−'
  return label.length <= 2 ? label : null
}

interface OriginalPartProps {
  readonly node: SchematicPartNode
  readonly designator: string
  readonly value: string | null
}

function OriginalTwoPin({ node, designator, value }: OriginalPartProps): JSX.Element | null {
  const pins = [...node.pins].sort((a, b) => a.y - b.y)
  const top = pins[0]
  const bottom = pins[1]
  if (top === undefined || bottom === undefined) return null

  const cx = node.x + node.width / 2
  const cy = (top.y + bottom.y) / 2
  const topMark = twoPinMark(top.label)
  const bottomMark = twoPinMark(bottom.label)

  return (
    <>
      <line className="cb-sch-original-lead" x1={top.x} y1={top.y} x2={cx} y2={top.y} />
      <line className="cb-sch-original-lead" x1={bottom.x} y1={bottom.y} x2={cx} y2={bottom.y} />
      {topMark === null ? null : (
        <text className="cb-sch-original-pin-name" x={top.x - 4} y={top.y + 3} textAnchor="end">
          {topMark}
        </text>
      )}
      {bottomMark === null ? null : (
        <text
          className="cb-sch-original-pin-name"
          x={bottom.x - 4}
          y={bottom.y + 3}
          textAnchor="end"
        >
          {bottomMark}
        </text>
      )}
      <g className="cb-sch-original-symbol" transform={`translate(${cx} ${cy}) rotate(90)`}>
        <GlyphBody type={node.type} vertical />
      </g>
      <text className="cb-sch-original-designator" x={cx + 42} y={cy - 7}>
        {designator}
      </text>
      {value === null ? null : (
        <text className="cb-sch-original-value" x={cx + 42} y={cy + 6}>
          {value}
        </text>
      )}
    </>
  )
}

function OriginalModule({ node, designator, value }: OriginalPartProps): JSX.Element {
  const boxLeft = node.x + 34
  const boxRight = node.x + node.width - 8
  const boxTop = node.y + 4
  const boxBottom = node.y + node.height - 4

  return (
    <>
      <rect
        className="cb-sch-original-module"
        x={boxLeft}
        y={boxTop}
        width={boxRight - boxLeft}
        height={boxBottom - boxTop}
        rx={2}
      />
      <text className="cb-sch-original-designator" x={boxRight + 8} y={boxTop + 14}>
        {designator}
      </text>
      {value === null ? null : (
        <text className="cb-sch-original-value" x={boxRight + 8} y={boxTop + 26}>
          {value}
        </text>
      )}
      {node.pins.map((pin, index) => (
        <g key={pin.key} data-pin={pin.key}>
          <line className="cb-sch-original-lead" x1={pin.x} y1={pin.y} x2={boxLeft} y2={pin.y} />
          <circle className="cb-sch-original-pin-dot" cx={pin.x} cy={pin.y} r={2} />
          <text className="cb-sch-original-pin-name" x={boxLeft + 6} y={pin.y + 3}>
            {pin.label}
          </text>
          <text
            className="cb-sch-original-pin-number"
            x={boxLeft - 4}
            y={pin.y - 3}
            textAnchor="end"
          >
            {index + 1}
          </text>
        </g>
      ))}
    </>
  )
}

function OriginalBoard({ node, designator }: OriginalPartProps): JSX.Element {
  return (
    <>
      <rect
        className="cb-sch-original-module cb-sch-original-board"
        x={node.x}
        y={node.y}
        width={node.width}
        height={node.height}
        rx={2}
      />
      <text className="cb-sch-original-designator" x={node.x + 10} y={node.y + 18}>
        {designator}
      </text>
      <text className="cb-sch-original-value" x={node.x + 10} y={node.y + 30}>
        {node.label}
      </text>
      {node.pins.map((pin) => (
        <g key={pin.key} data-pin={pin.key}>
          <line
            className="cb-sch-original-lead"
            x1={node.x + node.width}
            y1={pin.y}
            x2={pin.x}
            y2={pin.y}
          />
          <circle className="cb-sch-original-pin-dot" cx={pin.x} cy={pin.y} r={2} />
          <text
            className={`cb-sch-original-pin-name cb-sch-original-pin-${pin.kind}`}
            x={node.x + node.width - 8}
            y={pin.y + 3}
            textAnchor="end"
          >
            {pin.label}
          </text>
        </g>
      ))}
    </>
  )
}

function OriginalPart({ node, designator, value }: OriginalPartProps): JSX.Element {
  if (node.board) return <OriginalBoard node={node} designator={designator} value={value} />
  const moduleOnly =
    node.type === 'multimeter' || node.type === 'function-generator' || node.type === 'oscilloscope'
  const twoTerminal = !moduleOnly && definitionOf(node.type).pins.length === 2
  if (twoTerminal && node.pins.length === 2) {
    return <OriginalTwoPin node={node} designator={designator} value={value} />
  }
  return <OriginalModule node={node} designator={designator} value={value} />
}

interface TitleBlockProps {
  readonly x: number
  readonly y: number
  readonly project: string
  readonly paper: string
  readonly sheet: number
  readonly sheetCount: number
}

function TitleBlock({ x, y, project, paper, sheet, sheetCount }: TitleBlockProps): JSX.Element {
  return (
    <g className="cb-sch-titleblock" data-testid="schematic-title-block">
      <rect x={x} y={y} width={230} height={54} />
      <text className="cb-sch-titleblock-name" x={x + 10} y={y + 19}>
        {APP_NAME}
      </text>
      <text className="cb-sch-titleblock-project" x={x + 10} y={y + 35}>
        {project}
      </text>
      <line x1={x + 10} y1={y + 41} x2={x + 220} y2={y + 41} />
      <text className="cb-sch-titleblock-sheet" x={x + 220} y={y + 50} textAnchor="end">
        {paper} · Sheet {sheet}/{sheetCount}
      </text>
    </g>
  )
}

function Paper({
  width,
  height,
}: {
  readonly width: number
  readonly height: number
}): JSX.Element {
  const gridId = `cb-sch-grid-${useId().replace(/:/g, '')}`

  return (
    <>
      <defs>
        <pattern id={gridId} width={20} height={20} patternUnits="userSpaceOnUse">
          <circle cx={10} cy={10} r={0.8} fill="#d8d2c2" />
        </pattern>
      </defs>
      <rect className="cb-sch-paper" width={width} height={height} />
      <rect className="cb-sch-paper-grid" width={width} height={height} fill={`url(#${gridId})`} />
      <rect className="cb-sch-paper-frame" x={12} y={12} width={width - 24} height={height - 24} />
    </>
  )
}

const layoutCache = new WeakMap<CircuitDocument, Map<string, SchematicPagination>>()

function cacheKey(mode: SchematicMode, paper: SchematicPaper): string {
  return `${mode}:${paper}`
}

function cachedPagination(
  document: CircuitDocument,
  mode: SchematicMode,
  paper: SchematicPaper
): SchematicPagination | null {
  return layoutCache.get(document)?.get(cacheKey(mode, paper)) ?? null
}

function cachePagination(
  document: CircuitDocument,
  mode: SchematicMode,
  paper: SchematicPaper,
  pagination: SchematicPagination
): void {
  const byKey = layoutCache.get(document)
  if (byKey === undefined) {
    layoutCache.set(document, new Map([[cacheKey(mode, paper), pagination]]))
    return
  }
  byKey.set(cacheKey(mode, paper), pagination)
}

export function SchematicView(): JSX.Element {
  const document = useCircuitStore((state) => state.document)
  const projectName = useProjectStore((state) => state.name)
  const [mode, setMode] = useState<SchematicMode>(readStoredMode)
  const [paperSize, setPaperSize] = useState<SchematicPaper>(readStoredPaper)
  const [pagination, setPagination] = useState<SchematicPagination | null>(() =>
    cachedPagination(document, readStoredMode(), readStoredPaper())
  )
  const [pageIndex, setPageIndex] = useState(0)
  const [preparing, setPreparing] = useState(pagination === null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const original = mode === 'original'
  const paper = PAPER_PRESETS[paperSize]
  const pageCount = pagination?.pageCount ?? 0
  const safePageIndex = pageCount === 0 ? 0 : Math.min(pageIndex, pageCount - 1)
  const layout = pagination?.pages[safePageIndex] ?? null
  const empty = layout !== null && !preparing && layout.nodes.length === 0
  const totalNodes = useMemo(
    () => pagination?.pages.reduce((sum, page) => sum + page.nodes.length, 0) ?? 0,
    [pagination]
  )

  const sheet = useMemo(
    () => (layout === null ? null : fitSchematicToPaper(layout, paperSize)),
    [layout, paperSize]
  )

  useEffect(() => {
    setPageIndex(0)
  }, [document, mode, paperSize])

  useEffect(() => {
    const cached = cachedPagination(document, mode, paperSize)
    if (cached !== null) {
      setPagination(cached)
      setPreparing(false)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    setPreparing(true)
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      timer = setTimeout(() => {
        const next = layoutSchematicPages(document, {
          paperSize,
          ...(mode === 'original' ? { roomyTwoPin: true } : {}),
        })
        cachePagination(document, mode, paperSize, next)
        startTransition(() => {
          if (cancelled) return
          setPagination(next)
          setPreparing(false)
        })
      }, 0)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      if (timer !== null) clearTimeout(timer)
    }
  }, [document, mode, paperSize])

  const drawWidth = original ? paper.width : (layout?.width ?? 0)
  const drawHeight = original ? paper.height : (layout?.height ?? 0)

  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode)
    } catch {
      // Persistence is a convenience; the drawing still works without it.
    }
  }, [mode])

  useEffect(() => {
    try {
      localStorage.setItem(PAPER_STORAGE_KEY, paperSize)
    } catch {
      // Persistence is a convenience; the drawing still works without it.
    }
  }, [paperSize])

  const capturePng = useCallback(async (): Promise<string | null> => {
    const svg = svgRef.current
    if (svg === null) return null
    return rasterizeSvgToPng(svg, drawWidth, drawHeight, 2)
  }, [drawHeight, drawWidth])

  const capturePdf = useCallback(async (): Promise<string | null> => {
    const svg = svgRef.current
    if (!original || svg === null) return null
    return svgToPdfBase64(svg, drawWidth, drawHeight)
  }, [drawHeight, drawWidth, original])

  useEffect(() => registerPngCapture(capturePng), [capturePng])

  useEffect(() => {
    if (!original) return undefined
    return registerPdfCapture(capturePdf)
  }, [capturePdf, original])

  const wires = useMemo(
    () =>
      layout === null ? null : (
        <g className="cb-sch-wires">
          {layout.wires.map((wire) => (
            <g key={wire.netId} data-testid="schematic-wire" data-net-id={wire.netId}>
              {wire.paths.map((points, index) => (
                <polyline
                  key={index}
                  className={original ? 'cb-sch-original-wire' : 'cb-sch-wire'}
                  style={{ stroke: wire.color }}
                  points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                />
              ))}
              {wire.junctions.map((point, index) => (
                <circle
                  key={`junction-${index}`}
                  className={original ? 'cb-sch-original-junction' : 'cb-sch-junction'}
                  style={{ fill: wire.color }}
                  cx={point.x}
                  cy={point.y}
                  r={3.2}
                />
              ))}
            </g>
          ))}
        </g>
      ),
    [layout, original]
  )

  const nodes = useMemo(
    () =>
      layout === null ? null : original ? (
        <g className="cb-sch-original-nodes">
          {layout.nodes.map((node) => (
            <g
              key={node.id}
              className="cb-sch-original-part"
              data-testid="schematic-part"
              data-part-id={node.id}
              data-part-type={node.type}
            >
              <title>{node.label}</title>
              <OriginalPart node={node} designator={node.designator} value={node.value} />
            </g>
          ))}
        </g>
      ) : (
        <g className="cb-sch-nodes">
          {layout.nodes.map((node) => {
            const labelX = node.board ? node.x + 10 : node.x + 10
            const labelAnchor = 'start'
            return (
              <g
                key={node.id}
                data-testid="schematic-part"
                data-part-id={node.id}
                data-part-type={node.type}
              >
                <title>{`${node.designator} · ${node.label}${node.value === null ? '' : ` · ${node.value}`}`}</title>
                <rect
                  className={node.board ? 'cb-sch-node cb-sch-node-board' : 'cb-sch-node'}
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={7}
                />
                <text className="cb-sch-node-label" x={labelX} y={node.y + 17}>
                  {fittedLabel(node.label, node.width - 48, 12)}
                </text>
                <text
                  className="cb-sch-designator"
                  x={node.x + node.width - 10}
                  y={node.y + 17}
                  textAnchor="end"
                >
                  {node.designator}
                </text>
                {node.value === null ? null : (
                  <text className="cb-sch-value" x={labelX} y={node.y + node.height - 7}>
                    {fittedLabel(node.value, node.width - 20, 9)}
                  </text>
                )}
                <GlyphFor node={node} />
                {node.pins.map((pin) => (
                  <g key={pin.key} data-pin={pin.key}>
                    <line
                      className="cb-sch-pin"
                      x1={pin.side === 'right' ? node.x + node.width : node.x}
                      y1={pin.y}
                      x2={pin.x}
                      y2={pin.y}
                    />
                    <circle className="cb-sch-pin-dot" cx={pin.x} cy={pin.y} r={2.2} />
                    <text
                      className={`cb-sch-pin-label cb-sch-pin-${pin.kind}`}
                      x={labelX}
                      y={pin.y + 4}
                      textAnchor={labelAnchor}
                    >
                      {fittedLabel(pin.label, node.width - 20, 11)}
                    </text>
                  </g>
                ))}
              </g>
            )
          })}
        </g>
      ),
    [layout, original]
  )

  const netLabels = useMemo(
    () =>
      layout === null ? null : (
        <g className="cb-sch-netlabels">
          {layout.netLabels.map((label, index) => (
            <text
              key={`${label.netId}-${index}`}
              className="cb-sch-netlabel"
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
            >
              {label.label}
            </text>
          ))}
        </g>
      ),
    [layout]
  )

  const totalWires = useMemo(
    () => pagination?.pages.reduce((sum, page) => sum + page.wires.length, 0) ?? 0,
    [pagination]
  )
  const summary = preparing
    ? 'Preparing schematic…'
    : `Read-only · ${totalNodes} ${totalNodes === 1 ? 'part' : 'parts'} · ${totalWires} schematic ${totalWires === 1 ? 'net' : 'nets'} · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'}`

  return (
    <section className="cb-schematic" data-testid="schematic-view" aria-label="Schematic">
      <header className="cb-schematic-header">
        <span className="cb-schematic-title">Schematic</span>
        <span className="cb-schematic-hint" aria-live="polite">
          {summary}
        </span>
        <label className="cb-sch-paper-picker">
          <span>Paper</span>
          <select
            value={paperSize}
            data-testid="schematic-paper"
            onChange={(event) => setPaperSize(event.target.value as SchematicPaper)}
          >
            {(
              Object.entries(PAPER_PRESETS) as [
                SchematicPaper,
                (typeof PAPER_PRESETS)[SchematicPaper],
              ][]
            ).map(([value, preset]) => (
              <option key={value} value={value}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        {pageCount > 1 && (
          <div className="cb-sch-pager" role="group" aria-label="Schematic pages">
            <button
              type="button"
              className="cb-sch-pager-button is-prev"
              data-testid="schematic-page-prev"
              aria-label="Previous schematic page"
              disabled={safePageIndex === 0}
              onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
            >
              <Icon name="chevron" />
            </button>
            <span className="cb-sch-pager-label" data-testid="schematic-page">
              Page {safePageIndex + 1} / {pageCount}
            </span>
            <button
              type="button"
              className="cb-sch-pager-button"
              data-testid="schematic-page-next"
              aria-label="Next schematic page"
              disabled={safePageIndex >= pageCount - 1}
              onClick={() => setPageIndex((current) => Math.min(pageCount - 1, current + 1))}
            >
              <Icon name="chevron" />
            </button>
          </div>
        )}
        <div className="cb-sch-mode" role="group" aria-label="Schematic style">
          <button
            type="button"
            className={original ? '' : 'is-active'}
            aria-pressed={!original}
            data-testid="schematic-mode-simplified"
            onClick={() => setMode('simplified')}
          >
            Simplified
          </button>
          <button
            type="button"
            className={original ? 'is-active' : ''}
            aria-pressed={original}
            data-testid="schematic-mode-original"
            onClick={() => setMode('original')}
          >
            Original
          </button>
        </div>
      </header>

      {empty ? (
        <div className="cb-schematic-empty">
          <div className="cb-placeholder-card">
            <h2>No schematic yet</h2>
            <p>
              Place a component next to the breadboard and its connections will be drawn here. The
              breadboard itself is left out, because it is not a schematic symbol.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={`cb-schematic-canvas${original ? ' is-original' : ''}`}
          aria-busy={preparing}
        >
          {layout !== null && (
            <svg
              ref={svgRef}
              className="cb-schematic-svg"
              viewBox={`0 0 ${drawWidth} ${drawHeight}`}
              role="img"
              aria-label="Schematic of the current circuit"
              data-testid="schematic-svg"
              data-schematic-mode={mode}
              data-schematic-paper={original ? paperSize : 'none'}
              preserveAspectRatio="xMidYMid meet"
            >
              {original ? (
                <>
                  <Paper width={drawWidth} height={drawHeight} />
                  <g
                    transform={`translate(${sheet?.x ?? 0} ${sheet?.y ?? 0}) scale(${sheet?.scale ?? 1})`}
                  >
                    {wires}
                    {nodes}
                    {netLabels}
                  </g>
                  <TitleBlock
                    x={drawWidth - 242}
                    y={drawHeight - 66}
                    project={projectName}
                    paper={paper.label}
                    sheet={safePageIndex + 1}
                    sheetCount={Math.max(1, pageCount)}
                  />
                </>
              ) : (
                <>
                  {wires}
                  {nodes}
                  {netLabels}
                </>
              )}
            </svg>
          )}
          {preparing && (
            <div className="cb-sch-loading" role="status" aria-live="polite">
              <span className="cb-sch-spinner" aria-hidden="true" />
              <span>Preparing schematic…</span>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
