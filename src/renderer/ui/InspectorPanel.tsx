import type { JSX } from 'react'
import type { PartInstance } from '../../shared/circuit'
import { definitionOf } from '../parts/definitions'
import { useCircuitStore } from '../store/circuitStore'
import { useInteractionStore } from '../store/interactionStore'
import { Icon } from './Icon'

const WIRE_PALETTE = [
  { color: '#ffc928', label: 'Positive (yellow)' },
  { color: '#2f7df6', label: 'Negative / ground (blue)' },
  { color: '#6fb3ff', label: 'Signal (sky)' },
  { color: '#2e78c7', label: 'Signal (blue)' },
  { color: '#b9d9ff', label: 'Signal (ice)' },
  { color: '#101a27', label: 'Signal (ink)' },
] as const
const EMPTY_DIP_BITS: readonly boolean[] = []
const KEYPAD_KEYS = ['1', '2', '3', 'A', '4', '5', '6', 'B', '7', '8', '9', 'C', '*', '0', '#', 'D']

function formatSensorValue(
  level: number,
  spec: NonNullable<ReturnType<typeof definitionOf>['sensor']>
): string {
  const raw = spec.min + (spec.max - spec.min) * Math.min(1, Math.max(0, level))
  const step = spec.step ?? 1
  const value = Math.round(raw / step) * step
  const digits = step < 1 ? 1 : 0
  return `${value.toFixed(digits)}${spec.unit === undefined ? '' : ` ${spec.unit}`}`
}

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
  const dipBits = useInteractionStore((state) => state.dipBits[part.id] ?? EMPTY_DIP_BITS)
  const toggleDipBit = useInteractionStore((state) => state.toggleDipBit)
  const keypadKey = useInteractionStore((state) => state.keypadKeys[part.id])
  const setKeypadKey = useInteractionStore((state) => state.setKeypadKey)
  const definition = definitionOf(part.type)
  const fields = definition.propFields
  const sensorSpec = definition.sensor
  const dipCount = part.type === 'dip-switch-4' ? 4 : part.type === 'dip-switch-6' ? 6 : undefined
  const interactive =
    part.type === 'potentiometer' ||
    part.type === 'slide-switch' ||
    sensorSpec !== undefined ||
    dipCount !== undefined ||
    part.type === 'keypad-4x4'

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
      {sensorSpec !== undefined && sensorSpec.control === 'toggle' && (
        <label className="cb-field cb-field-inline">
          <span>{sensorSpec.label}</span>
          <input
            type="checkbox"
            checked={sensorLevel > 0.5}
            data-testid="sensor-toggle"
            onChange={() => setSensor(part.id, sensorLevel > 0.5 ? 0 : 1)}
          />
        </label>
      )}
      {sensorSpec !== undefined && sensorSpec.control !== 'toggle' && (
        <label className="cb-field">
          <span>
            {sensorSpec.label} {formatSensorValue(sensorLevel, sensorSpec)}
          </span>
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
      {part.type === 'keypad-4x4' && (
        <label className="cb-field">
          <span>Key pressed</span>
          <select
            value={keypadKey === undefined ? '' : String(keypadKey)}
            data-testid="keypad-key"
            onChange={(event) => {
              const value = event.target.value
              setKeypadKey(part.id, value === '' ? null : Number(value))
            }}
          >
            <option value="">None</option>
            {KEYPAD_KEYS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
      {dipCount !== undefined && (
        <div className="cb-field">
          <span>Switches</span>
          <div className="cb-dip-bits">
            {Array.from({ length: dipCount }, (_unused, bit) => (
              <label key={bit} className="cb-dip-bit">
                <span>{bit + 1}</span>
                <input
                  type="checkbox"
                  checked={dipBits[bit] === true}
                  data-testid={`dip-bit-${bit + 1}`}
                  onChange={() => toggleDipBit(part.id, bit)}
                />
              </label>
            ))}
          </div>
        </div>
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
            {WIRE_PALETTE.map((swatch) => (
              <button
                key={swatch.color}
                type="button"
                className={[
                  'cb-swatch',
                  swatch.color.toLowerCase() === selectedWire.color.toLowerCase()
                    ? 'is-active'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ background: swatch.color }}
                title={`${swatch.label} · ${swatch.color}`}
                aria-label={`${swatch.label} ${swatch.color}`}
                onClick={() => setWireColor(swatch.color)}
              />
            ))}
          </div>
          <p className="cb-placeholder">
            Drag a blue handle to move a bend, double-click it to remove it, or drag the round blue
            handle to add one. Yellow endpoint handles reconnect a wire; press Delete to remove it.
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
