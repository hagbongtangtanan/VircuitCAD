import { useMemo, useState, type DragEvent, type JSX } from 'react'
import { PART_DRAG_MIME } from '../canvas/dnd'
import { definitionOf, partDefinitions, type PartDefinition } from '../parts/definitions'
import { screenToWorld, snapPoint } from '../canvas/geometry'
import { useCircuitStore } from '../store/circuitStore'
import { useProjectStore } from '../store/projectStore'
import { useViewportStore } from '../store/viewportStore'

/** Curated starting set, closest to what a beginner reaches for first. */
const BASIC_TYPES = [
  'led',
  'resistor',
  'push-button',
  'potentiometer',
  'buzzer',
  'capacitor',
  'rgb-led',
  'slide-switch',
] as const

const CATEGORY_ORDER = ['boards', 'outputs', 'inputs', 'passives'] as const

const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  boards: 'Boards',
  outputs: 'Outputs',
  inputs: 'Inputs',
  passives: 'Passives',
}

type PanelSection = 'basic' | 'all' | 'starters'

const SECTION_LABELS: Record<PanelSection, string> = {
  basic: 'Basic',
  all: 'All parts',
  starters: 'Starters',
}

const PART_COLORS: Record<string, [string, string]> = {
  'arduino-uno': ['#0f8ea8', '#0b6d82'],
  breadboard: ['#f2efe7', '#cdc7b8'],
  led: ['#e5484d', '#b33236'],
  resistor: ['#e0cfa4', '#bda875'],
  'push-button': ['#4a5468', '#333a49'],
  potentiometer: ['#586374', '#3d4557'],
  buzzer: ['#3b4252', '#272d3a'],
  capacitor: ['#5b6472', '#3d4557'],
  diode: ['#3b4252', '#272d3a'],
  inductor: ['#b9895a', '#8d6339'],
  'slide-switch': ['#586374', '#3d4557'],
  ldr: ['#e0c26b', '#b99b45'],
  'rgb-led': ['#e5484d', '#2f7df6'],
  'seven-segment': ['#2b2f3a', '#14171e'],
  'dc-motor': ['#6b7488', '#464e60'],
  'battery-aa': ['#3b4252', '#272d3a'],
  'battery-9v': ['#3b4252', '#272d3a'],
  'power-supply': ['#4a5468', '#333a49'],
}

/** Flat two-tone glyph so a part is recognisable at a glance without art. */
function PartThumbnail({ type }: { readonly type: string }): JSX.Element {
  const [top, bottom] = PART_COLORS[type] ?? ['#586374', '#3d4557']
  return (
    <span
      className="cb-part-thumb"
      aria-hidden="true"
      style={{ background: `linear-gradient(160deg, ${top}, ${bottom})` }}
    >
      <span className={`cb-part-glyph cb-part-glyph-${type}`} />
    </span>
  )
}

export function PartsPanel(): JSX.Element {
  const [section, setSection] = useState<PanelSection>('basic')
  const [query, setQuery] = useState('')

  const addPart = useCircuitStore((state) => state.addPart)
  const viewport = useViewportStore((state) => state.viewport)
  const size = useViewportStore((state) => state.size)

  const samples = useProjectStore((state) => state.samples)
  const openSample = useProjectStore((state) => state.openSample)
  const busy = useProjectStore((state) => state.busy)

  const search = query.trim().toLowerCase()

  const visible = useMemo(() => {
    const pool =
      section === 'basic'
        ? partDefinitions.filter((definition) =>
            BASIC_TYPES.includes(definition.type as (typeof BASIC_TYPES)[number])
          )
        : partDefinitions
    if (search === '') return pool
    return pool.filter(
      (definition) =>
        definition.label.toLowerCase().includes(search) ||
        definition.type.toLowerCase().includes(search)
    )
  }, [search, section])

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    definition: PartDefinition
  ): void => {
    event.dataTransfer.setData(PART_DRAG_MIME, definition.type)
    event.dataTransfer.effectAllowed = 'copy'
  }

  const handleClick = (definition: PartDefinition): void => {
    // Drop it in the middle of what the user is looking at, then walk right and
    // down until the footprint no longer covers an existing part.
    const centre = screenToWorld({ x: size.width / 2, y: size.height / 2 }, viewport)
    const start = {
      x: centre.x - definition.size.width / 2,
      y: centre.y - definition.size.height / 2,
    }
    const parts = useCircuitStore.getState().document.parts
    const overlaps = (candidate: { x: number; y: number }): boolean =>
      parts.some((part) => {
        const other = definitionOf(part.type).size
        return (
          candidate.x < part.position.x + other.width &&
          candidate.x + definition.size.width > part.position.x &&
          candidate.y < part.position.y + other.height &&
          candidate.y + definition.size.height > part.position.y
        )
      })

    // Walk outwards in rings. The step is derived from the part's own footprint
    // so large parts (Uno, seven-segment) can escape a neighbour instead of
    // stacking inside it thirty pixels at a time.
    const stepX = Math.max(30, definition.size.width / 2)
    const stepY = Math.max(30, definition.size.height / 2)
    let position = snapPoint(start)
    outer: for (let ring = 0; ring <= 12; ring += 1) {
      const cells: { column: number; row: number }[] = []
      for (let row = -ring; row <= ring; row += 1) {
        for (let column = -ring; column <= ring; column += 1) {
          if (Math.max(Math.abs(row), Math.abs(column)) !== ring) continue
          cells.push({ column, row })
        }
      }
      cells.sort(
        (a, b) => a.column * a.column + a.row * a.row - (b.column * b.column + b.row * b.row)
      )
      for (const cell of cells) {
        const candidate = snapPoint({
          x: start.x + cell.column * stepX,
          y: start.y + cell.row * stepY,
        })
        if (!overlaps(candidate)) {
          position = candidate
          break outer
        }
      }
    }

    addPart(definition.type, position)
  }

  return (
    <aside className="cb-parts-panel" aria-label="Parts" data-testid="part-drawer">
      <header className="cb-parts-header">
        <select
          className="cb-section-select"
          aria-label="Part library"
          data-testid="parts-section"
          value={section}
          onChange={(event) => setSection(event.target.value as PanelSection)}
        >
          {(Object.keys(SECTION_LABELS) as PanelSection[]).map((key) => (
            <option key={key} value={key}>
              {SECTION_LABELS[key]}
            </option>
          ))}
        </select>
        <input
          className="cb-search"
          type="search"
          value={query}
          placeholder="Search parts"
          aria-label="Search parts"
          data-testid="parts-search"
          onChange={(event) => setQuery(event.target.value)}
        />
      </header>

      <div className="cb-parts-scroll">
        {section === 'starters' ? (
          <div className="cb-starters" data-testid="samples">
            {samples.length === 0 ? (
              <p className="cb-placeholder">No starter circuits are installed.</p>
            ) : (
              samples.map((sample) => (
                <button
                  key={sample.name}
                  type="button"
                  className="cb-starter"
                  data-sample={sample.name}
                  disabled={busy}
                  title={`Open the ${sample.label} starter`}
                  onClick={() => void openSample(sample.name)}
                >
                  <span className="cb-starter-title">{sample.label}</span>
                  <span className="cb-starter-file">{sample.name}</span>
                </button>
              ))
            )}
          </div>
        ) : section === 'basic' ? (
          <div className="cb-part-grid">
            {visible.map((definition) => (
              <PartCard
                key={definition.type}
                definition={definition}
                onDragStart={handleDragStart}
                onClick={handleClick}
              />
            ))}
          </div>
        ) : (
          CATEGORY_ORDER.map((category) => {
            const items = visible.filter((definition) => definition.category === category)
            if (items.length === 0) return null
            return (
              <section key={category} className="cb-part-group">
                <h3 className="cb-part-group-title">{CATEGORY_LABELS[category]}</h3>
                <div className="cb-part-grid">
                  {items.map((definition) => (
                    <PartCard
                      key={definition.type}
                      definition={definition}
                      onDragStart={handleDragStart}
                      onClick={handleClick}
                    />
                  ))}
                </div>
              </section>
            )
          })
        )}
        {section !== 'starters' && visible.length === 0 && (
          <p className="cb-placeholder">No parts match “{query}”.</p>
        )}
      </div>
    </aside>
  )
}

interface PartCardProps {
  readonly definition: PartDefinition
  readonly onDragStart: (event: DragEvent<HTMLButtonElement>, definition: PartDefinition) => void
  readonly onClick: (definition: PartDefinition) => void
}

function PartCard({ definition, onDragStart, onClick }: PartCardProps): JSX.Element {
  return (
    <button
      type="button"
      className="cb-part-card"
      draggable
      data-part-type={definition.type}
      data-testid={`part-${definition.type}`}
      title={`Drag onto the canvas, or click to place ${definition.label}`}
      onDragStart={(event) => onDragStart(event, definition)}
      onClick={() => onClick(definition)}
    >
      <PartThumbnail type={definition.type} />
      <span className="cb-part-card-label">{definition.label}</span>
    </button>
  )
}
