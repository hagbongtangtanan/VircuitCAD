import type { JSX } from 'react'
import type { PartInstance } from '../../shared/circuit'
import { definitionOf } from '../parts/definitions'
import { useCircuitStore } from '../store/circuitStore'

function readProp(part: PartInstance, key: string): string | number | undefined {
  const props: Record<string, unknown> = { ...part.props }
  const value = props[key]
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function PartFields({ part }: { readonly part: PartInstance }): JSX.Element {
  const setPartProp = useCircuitStore((state) => state.setPartProp)
  const fields = definitionOf(part.type).propFields

  if (fields.length === 0) {
    return <p className="app-placeholder">No editable properties.</p>
  }

  return (
    <div className="inspector-fields">
      {fields.map((field) => {
        const value = readProp(part, field.key)
        if (field.kind === 'number') {
          return (
            <label key={field.key} className="inspector-field">
              <span>
                {field.label}
                {field.unit !== undefined ? ` (${field.unit})` : ''}
              </span>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={typeof value === 'number' ? value : field.min}
                onChange={(event) => setPartProp(part.id, field.key, event.target.value)}
              />
            </label>
          )
        }
        return (
          <label key={field.key} className="inspector-field">
            <span>{field.label}</span>
            <select
              value={typeof value === 'string' ? value : ''}
              onChange={(event) => setPartProp(part.id, field.key, event.target.value)}
            >
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        )
      })}
    </div>
  )
}

export function PartInspector(): JSX.Element {
  const selectedPartIds = useCircuitStore((state) => state.selectedPartIds)
  const selectedWireId = useCircuitStore((state) => state.selectedWireId)
  const parts = useCircuitStore((state) => state.document.parts)
  const wires = useCircuitStore((state) => state.document.wires)
  const setWireColor = useCircuitStore((state) => state.setWireColor)

  const selectedWire = wires.find((wire) => wire.id === selectedWireId)
  const singlePart =
    selectedPartIds.length === 1 ? parts.find((part) => part.id === selectedPartIds[0]) : undefined

  return (
    <div className="inspector" data-testid="inspector">
      <h2 className="app-panel-title">Inspector</h2>

      {selectedWire !== undefined && (
        <div className="inspector-fields">
          <label className="inspector-field">
            <span>Wire color</span>
            <input
              type="color"
              value={selectedWire.color}
              onChange={(event) => setWireColor(event.target.value)}
            />
          </label>
          <p className="app-placeholder">
            Drag the blue handle on the wire to add a bend; drag a yellow handle to move one.
          </p>
        </div>
      )}

      {selectedWire === undefined && singlePart !== undefined && (
        <>
          <p className="inspector-title">{definitionOf(singlePart.type).label}</p>
          <PartFields part={singlePart} />
        </>
      )}

      {selectedWire === undefined && selectedPartIds.length > 1 && (
        <p className="app-placeholder">{selectedPartIds.length} parts selected.</p>
      )}

      {selectedWire === undefined && singlePart === undefined && selectedPartIds.length === 0 && (
        <p className="app-placeholder">Nothing selected. Click a part or a wire to edit it.</p>
      )}
    </div>
  )
}
