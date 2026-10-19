import type { JSX } from 'react'
import type { PartInstance } from '../../shared/circuit'
import { definitionOf } from '../parts/definitions'
import { useCircuitStore } from '../store/circuitStore'
import { useInteractionStore } from '../store/interactionStore'
import { Icon } from './Icon'

const WIRE_PALETTE = ['#2f7df6', '#1f9d55', '#d64545', '#d99311', '#7c5cff', '#20242c'] as const

function readProp(part: PartInstance, key: string): string | number | undefined {
  const props: Record<string, unknown> = { ...part.props }
  const value = props[key]
  return typeof value === 'string' || typeof value === 'number' ? value : undefined
}

function PartFields({ part }: { readonly part: PartInstance }): JSX.Element {
  const setPartProp = useCircuitStore((state) => state.setPartProp)
  const potPosition = useInteractionStore((state) => state.pots[part.id] ?? 0.5)
  const setPot = useInteractionStore((state) => state.setPot)
  const switchOn = useInteractionStore((state) => state.switches[part.id] ?? false)
  const toggleSwitch = useInteractionStore((state) => state.toggleSwitch)
  const sensorLevel = useInteractionStore((state) => state.sensors[part.id] ?? 0.5)
  const setSensor = useInteractionStore((state) => state.setSensor)
  const fields = definitionOf(part.type).propFields
  const interactive =
    part.type === 'potentiometer' || part.type === 'slide-switch' || part.type === 'ldr'

  if (fields.length === 0 && !interactive) {
    return <p className="cb-placeholder">No editable properties.</p>
  }

  return (
    <div className="cb-inspector-fields">
      {part.type === 'potentiometer' && (
        <label className="cb-field">
          <span>Wiper {Math.round(potPosition * 100)}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(potPosition * 100)}
            data-testid="pot-slider"
            onChange={(event) => setPot(part.id, Number(event.target.value) / 100)}
          />
        </label>
      )}
      {part.type === 'slide-switch' && (
        <label className="cb-field cb-field-inline">
          <span>Closed</span>
          <input
            type="checkbox"
            checked={switchOn}
            data-testid="switch-toggle"
            onChange={() => toggleSwitch(part.id)}
          />
        </label>
      )}
      {part.type === 'ldr' && (
        <label className="cb-field">
          <span>Light {Math.round(sensorLevel * 100)}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(sensorLevel * 100)}
            data-testid="sensor-slider"
            onChange={(event) => setSensor(part.id, Number(event.target.value) / 100)}
          />
        </label>
      )}
      {fields.map((field) => {
        const value = readProp(part, field.key)
        if (field.kind === 'number') {
          return (
            <label key={field.key} className="cb-field">
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
          <label key={field.key} className="cb-field">
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

/**
 * Floating inspector for the current selection. It only appears once something
 * is selected, so the canvas keeps the whole window when it is idle.
 */
export function InspectorPanel(): JSX.Element | null {
  const selectedPartIds = useCircuitStore((state) => state.selectedPartIds)
  const selectedWireId = useCircuitStore((state) => state.selectedWireId)
  const parts = useCircuitStore((state) => state.document.parts)
  const wires = useCircuitStore((state) => state.document.wires)
  const setWireColor = useCircuitStore((state) => state.setWireColor)
  const selectParts = useCircuitStore((state) => state.selectParts)
  const selectWire = useCircuitStore((state) => state.selectWire)

  const selectedWire = wires.find((wire) => wire.id === selectedWireId)
  const singlePart =
    selectedPartIds.length === 1 ? parts.find((part) => part.id === selectedPartIds[0]) : undefined
  const visible = selectedWire !== undefined || selectedPartIds.length > 0

  if (!visible) return null

  const dismiss = (): void => {
    selectParts([])
    selectWire(null)
  }

  const title =
    selectedWire !== undefined
      ? 'Wire'
      : singlePart !== undefined
        ? definitionOf(singlePart.type).label
        : `${selectedPartIds.length} parts`

  return (
    <div className="cb-inspector" data-testid="inspector" role="dialog" aria-label="Inspector">
      <header className="cb-inspector-header">
        <span className="cb-inspector-title">{title}</span>
        <button
          type="button"
          className="cb-icon-button"
          title="Close the inspector"
          data-testid="inspector-close"
          onClick={dismiss}
        >
          <Icon name="close" />
        </button>
      </header>

      {selectedWire !== undefined && (
        <div className="cb-inspector-fields">
          <label className="cb-field">
            <span>Wire color</span>
            <input
              type="color"
              value={selectedWire.color}
              onChange={(event) => setWireColor(event.target.value)}
            />
          </label>
          <div className="cb-swatches" role="group" aria-label="Wire color palette">
            {WIRE_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                className={[
                  'cb-swatch',
                  color.toLowerCase() === selectedWire.color.toLowerCase() ? 'is-active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ background: color }}
                title={`Use ${color}`}
                aria-label={`Use ${color}`}
                onClick={() => setWireColor(color)}
              />
            ))}
          </div>
          <p className="cb-placeholder">
            Drag the blue handle on a wire to add a bend; drag a yellow handle to move one.
          </p>
        </div>
      )}

      {selectedWire === undefined && singlePart !== undefined && <PartFields part={singlePart} />}

      {selectedWire === undefined && singlePart === undefined && (
        <p className="cb-placeholder">
          {selectedPartIds.length} parts selected. Select a single part to edit its properties.
        </p>
      )}
    </div>
  )
}
