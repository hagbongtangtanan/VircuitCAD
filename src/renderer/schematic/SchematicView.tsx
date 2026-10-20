import { useCallback, useEffect, useId, useMemo, useRef, useState, type JSX } from 'react'
import { registerPngCapture } from '../export/pngCapture'
import { rasterizeSvgToPng } from '../export/svgPng'
import { definitionOf } from '../parts/definitions'
import { useCircuitStore } from '../store/circuitStore'
import { useProjectStore } from '../store/projectStore'
import { partValue, referenceDesignators } from './annotations'
import { layoutSchematic, type SchematicPartNode } from './layout'

/**
 * One colour per net, so wires that share a channel stay distinguishable even
 * when their routes run side by side.
 */
const NET_COLORS = ['#6ea8ff', '#63d3a6', '#e8a13a', '#c58cff', '#ff8f9c', '#61d4e0'] as const

type SchematicMode = 'simplified' | 'original'

const MODE_STORAGE_KEY = 'hucad.schematicMode'

function netColor(netId: number): string {
  return NET_COLORS[netId % NET_COLORS.length] ?? NET_COLORS[0]
}

function readStoredMode(): SchematicMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === 'original' ? 'original' : 'simplified'
  } catch {
    return 'simplified'
  }
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
            M
          </text>
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
    default:
      return null
  }
}

function GlyphFor({ node }: { readonly node: SchematicPartNode }): JSX.Element | null {
  if (node.board) return null

  const body = <GlyphBody type={node.type} />
  if (body === null) return null

  const cx = node.x + 116
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
  const twoTerminal = definitionOf(node.type).pins.length === 2
  if (twoTerminal && node.pins.length === 2) {
    return <OriginalTwoPin node={node} designator={designator} value={value} />
  }
  return <OriginalModule node={node} designator={designator} value={value} />
}

interface TitleBlockProps {
  readonly x: number
  readonly y: number
  readonly project: string
}

function TitleBlock({ x, y, project }: TitleBlockProps): JSX.Element {
  return (
    <g className="cb-sch-titleblock" data-testid="schematic-title-block">
      <rect x={x} y={y} width={230} height={54} />
      <text className="cb-sch-titleblock-name" x={x + 10} y={y + 19}>
        HuCAD
      </text>
      <text className="cb-sch-titleblock-project" x={x + 10} y={y + 35}>
        {project}
      </text>
      <line x1={x + 10} y1={y + 41} x2={x + 220} y2={y + 41} />
      <text className="cb-sch-titleblock-sheet" x={x + 220} y={y + 50} textAnchor="end">
        Schematic · Sheet 1/1
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

export function SchematicView(): JSX.Element {
  const document = useCircuitStore((state) => state.document)
  const projectName = useProjectStore((state) => state.name)
  const [mode, setMode] = useState<SchematicMode>(readStoredMode)
  const layout = useMemo(
    () => layoutSchematic(document, mode === 'original' ? { roomyTwoPin: true } : {}),
    [document, mode]
  )
  const designators = useMemo(() => {
    const byId = new Map(document.parts.map((part) => [part.id, part]))
    return referenceDesignators(
      layout.nodes.flatMap((node) => {
        const part = byId.get(node.id)
        return part === undefined ? [] : [part]
      })
    )
  }, [document.parts, layout.nodes])
  const empty = layout.nodes.length === 0
  const svgRef = useRef<SVGSVGElement | null>(null)
  const original = mode === 'original'
  const drawWidth = layout.width
  const drawHeight = original ? layout.height + 84 : layout.height

  useEffect(() => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode)
    } catch {
      // Persistence is a convenience; the drawing still works without it.
    }
  }, [mode])

  const capturePng = useCallback(async (): Promise<string | null> => {
    const svg = svgRef.current
    if (svg === null) return null
    return rasterizeSvgToPng(svg, drawWidth, drawHeight, 2)
  }, [drawHeight, drawWidth])

  useEffect(() => registerPngCapture(capturePng), [capturePng])

  return (
    <section className="cb-schematic" data-testid="schematic-view" aria-label="Schematic">
      <header className="cb-schematic-header">
        <span className="cb-schematic-title">Schematic</span>
        <span className="cb-schematic-hint">
          Read-only · {layout.nodes.length} {layout.nodes.length === 1 ? 'part' : 'parts'} ·{' '}
          {layout.wires.length} {layout.wires.length === 1 ? 'net' : 'nets'}
        </span>
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
        <div className={`cb-schematic-canvas${original ? ' is-original' : ''}`}>
          <svg
            ref={svgRef}
            className="cb-schematic-svg"
            viewBox={`0 0 ${drawWidth} ${drawHeight}`}
            role="img"
            aria-label="Schematic of the current circuit"
            data-testid="schematic-svg"
            data-schematic-mode={mode}
            preserveAspectRatio="xMidYMid meet"
          >
            {original ? (
              <>
                <Paper width={drawWidth} height={drawHeight} />
                <g className="cb-sch-wires">
                  {layout.wires.map((wire) => (
                    <g key={wire.netId} data-testid="schematic-wire" data-net-id={wire.netId}>
                      {wire.paths.map((points, index) => (
                        <polyline
                          key={index}
                          className="cb-sch-original-wire"
                          points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                        />
                      ))}
                      {wire.junctions.map((point, index) => (
                        <circle
                          key={`junction-${index}`}
                          className="cb-sch-original-junction"
                          cx={point.x}
                          cy={point.y}
                          r={3.2}
                        />
                      ))}
                    </g>
                  ))}
                </g>

                <g className="cb-sch-original-nodes">
                  {layout.nodes.map((node) => {
                    const part = document.parts.find((candidate) => candidate.id === node.id)
                    const designator = designators.get(node.id) ?? '?'
                    return (
                      <g
                        key={node.id}
                        className="cb-sch-original-part"
                        data-testid="schematic-part"
                        data-part-id={node.id}
                        data-part-type={node.type}
                      >
                        <title>{node.label}</title>
                        <OriginalPart
                          node={node}
                          designator={designator}
                          value={part === undefined ? null : partValue(part)}
                        />
                      </g>
                    )
                  })}
                </g>

                <TitleBlock x={drawWidth - 242} y={drawHeight - 66} project={projectName} />
              </>
            ) : (
              <>
                <g className="cb-sch-wires">
                  {layout.wires.map((wire) => {
                    const color = netColor(wire.netId)
                    return (
                      <g key={wire.netId} data-testid="schematic-wire" data-net-id={wire.netId}>
                        {wire.paths.map((points, index) => (
                          <polyline
                            key={index}
                            className="cb-sch-wire"
                            style={{ stroke: color }}
                            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                          />
                        ))}
                        {wire.junctions.map((point, index) => (
                          <circle
                            key={`junction-${index}`}
                            className="cb-sch-junction"
                            style={{ fill: color }}
                            cx={point.x}
                            cy={point.y}
                            r={3.2}
                          />
                        ))}
                      </g>
                    )
                  })}
                </g>

                <g className="cb-sch-nodes">
                  {layout.nodes.map((node) => {
                    const labelX = node.board ? node.x + node.width - 10 : node.x + 10
                    const labelAnchor = node.board ? 'end' : 'start'
                    return (
                      <g
                        key={node.id}
                        data-testid="schematic-part"
                        data-part-id={node.id}
                        data-part-type={node.type}
                      >
                        <title>{node.label}</title>
                        <rect
                          className={node.board ? 'cb-sch-node cb-sch-node-board' : 'cb-sch-node'}
                          x={node.x}
                          y={node.y}
                          width={node.width}
                          height={node.height}
                          rx={7}
                        />
                        <text
                          className="cb-sch-node-label"
                          x={node.board ? node.x + 12 : node.x + node.width - 12}
                          y={node.y + 19}
                          textAnchor={node.board ? 'start' : 'end'}
                        >
                          {node.label}
                        </text>
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
                              {pin.label}
                            </text>
                          </g>
                        ))}
                      </g>
                    )
                  })}
                </g>
              </>
            )}
          </svg>
        </div>
      )}
    </section>
  )
}
