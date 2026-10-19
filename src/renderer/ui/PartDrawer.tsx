import type { DragEvent, JSX } from 'react'
import type { PartDefinition } from '../parts/definitions'
import { definitionOf, partDefinitions } from '../parts/definitions'
import { useCircuitStore } from '../store/circuitStore'
import { PART_DRAG_MIME } from '../canvas/dnd'

const CATEGORY_ORDER = ['boards', 'outputs', 'inputs', 'passives'] as const

const CATEGORY_LABELS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  boards: 'Boards',
  outputs: 'Outputs',
  inputs: 'Inputs',
  passives: 'Passives',
}

const SWATCHES: Partial<Record<PartDefinition['type'], string>> = {
  'arduino-uno': '#0f7c92',
  breadboard: '#e8e3d9',
  led: '#e5484d',
  resistor: '#d8cfae',
  'push-button': '#3b4252',
  potentiometer: '#4a5468',
  buzzer: '#2b3140',
}

export function PartDrawer(): JSX.Element {
  const addPart = useCircuitStore((state) => state.addPart)
  const partCount = useCircuitStore((state) => state.document.parts.length)

  const handleDragStart = (
    event: DragEvent<HTMLButtonElement>,
    definition: PartDefinition
  ): void => {
    event.dataTransfer.setData(PART_DRAG_MIME, definition.type)
    event.dataTransfer.effectAllowed = 'copy'
  }

  const handleClick = (definition: PartDefinition): void => {
    const column = partCount % 4
    const row = Math.floor(partCount / 4)
    addPart(definition.type, {
      x: 60 + column * (definitionOf(definition.type).size.width / 2 + 30),
      y: 80 + row * 60,
    })
  }

  return (
    <aside className="part-drawer" aria-label="Parts drawer" data-testid="part-drawer">
      {CATEGORY_ORDER.map((category) => (
        <section key={category}>
          <h2 className="app-panel-title">{CATEGORY_LABELS[category]}</h2>
          <div className="part-drawer-grid">
            {partDefinitions
              .filter((definition) => definition.category === category)
              .map((definition) => (
                <button
                  key={definition.type}
                  type="button"
                  className="part-drawer-item"
                  draggable
                  data-part-type={definition.type}
                  title={`Drag onto the canvas, or click to place ${definition.label}`}
                  onDragStart={(event) => handleDragStart(event, definition)}
                  onClick={() => handleClick(definition)}
                >
                  <span
                    className="part-drawer-swatch"
                    style={{ background: SWATCHES[definition.type] ?? '#2b3140' }}
                  />
                  <span className="part-drawer-label">{definition.label}</span>
                </button>
              ))}
          </div>
        </section>
      ))}
    </aside>
  )
}
