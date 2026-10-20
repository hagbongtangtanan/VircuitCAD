import { useMemo, type JSX } from 'react'
import { useCircuitStore } from '../store/circuitStore'
import { layoutSchematic, type SchematicPartNode } from './layout'

/**
 * One colour per net, so wires that share a channel stay distinguishable even
 * when their routes run side by side.
 */
const NET_COLORS = ['#6ea8ff', '#63d3a6', '#e8a13a', '#c58cff', '#ff8f9c', '#61d4e0'] as const

function netColor(netId: number): string {
  return NET_COLORS[netId % NET_COLORS.length] ?? NET_COLORS[0]
}

function GlyphFor({ node }: { readonly node: SchematicPartNode }): JSX.Element | null {
  if (node.board) return null

  const cx = node.x + 116
  const cy = node.y + node.height / 2
  const title = node.type.replace(/-/g, ' ')

  const body = ((): JSX.Element | null => {
    switch (node.type) {
      case 'resistor':
      case 'potentiometer':
      case 'ldr': {
        const zigzag = (
          <path d="M -34 0 H -28 L -22 -10 L -14 10 L -6 -10 L 2 10 L 10 -10 L 16 0 H 22 M 22 0 H 34" />
        )
        if (node.type === 'potentiometer') {
          return (
            <>
              {zigzag}
              <path d="M 0 -24 V -8" />
              <path className="cb-sch-glyph-fill" d="M -4 -10 L 4 -10 L 0 -4 Z" />
            </>
          )
        }
        if (node.type === 'ldr') {
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
            {node.type === 'rgb-led' ? (
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
            <text className="cb-sch-glyph-text" x={0} y={4} textAnchor="middle">
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
  })()

  if (body === null) return null

  return (
    <g className="cb-sch-glyph" transform={`translate(${cx} ${cy})`} aria-hidden="true">
      <title>{title}</title>
      {body}
    </g>
  )
}

export function SchematicView(): JSX.Element {
  const document = useCircuitStore((state) => state.document)
  const layout = useMemo(() => layoutSchematic(document), [document])
  const empty = layout.nodes.length === 0

  return (
    <section className="cb-schematic" data-testid="schematic-view" aria-label="Schematic">
      <header className="cb-schematic-header">
        <span className="cb-schematic-title">Schematic</span>
        <span className="cb-schematic-hint">
          Read-only · {layout.nodes.length} {layout.nodes.length === 1 ? 'part' : 'parts'} ·{' '}
          {layout.wires.length} {layout.wires.length === 1 ? 'net' : 'nets'}
        </span>
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
        <div className="cb-schematic-canvas">
          <svg
            className="cb-schematic-svg"
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            role="img"
            aria-label="Schematic of the current circuit"
            data-testid="schematic-svg"
            preserveAspectRatio="xMidYMid meet"
          >
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
          </svg>
        </div>
      )}
    </section>
  )
}
