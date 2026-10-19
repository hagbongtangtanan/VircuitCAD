import type { LedColor, PartInstance, PartPropsMap, PartType, Point } from '../../shared/circuit'
import { rotateOffset, type Size } from '../canvas/geometry'

export type PinKind = 'power' | 'ground' | 'digital' | 'analog' | 'passive'

export interface PartPin {
  readonly id: string
  readonly label: string
  /** Offset from the part's top-left origin, before rotation. */
  readonly position: Point
  readonly kind: PinKind
}

export type PropField =
  | {
      readonly kind: 'number'
      readonly key: string
      readonly label: string
      readonly min: number
      readonly max: number
      readonly step: number
      readonly unit?: string
    }
  | {
      readonly kind: 'select'
      readonly key: string
      readonly label: string
      readonly options: readonly string[]
    }

export interface PartDefinition<Type extends PartType = PartType> {
  readonly type: Type
  readonly label: string
  readonly category: 'boards' | 'outputs' | 'inputs' | 'passives'
  readonly size: Size
  readonly defaultProps: PartPropsMap[Type]
  readonly pins: readonly PartPin[]
  /**
   * Pin groups that are connected inside the part itself and must therefore end
   * up in the same net (breadboard strips and rails, switch contacts, ...).
   */
  readonly internalNets?: readonly (readonly string[])[]
  readonly propFields: readonly PropField[]
}

function pin(id: string, label: string, position: Point, kind: PinKind = 'passive'): PartPin {
  return { id, label, position, kind }
}

export const ledDefinition: PartDefinition<'led'> = {
  type: 'led',
  label: 'LED',
  category: 'outputs',
  size: { width: 40, height: 40 },
  defaultProps: { color: 'red' },
  pins: [pin('anode', 'A', { x: 10, y: 40 }), pin('cathode', 'K', { x: 30, y: 40 })],
  propFields: [
    {
      kind: 'select',
      key: 'color',
      label: 'Color',
      options: ['red', 'green', 'blue', 'yellow', 'white'] satisfies readonly LedColor[],
    },
  ],
}

export const resistorDefinition: PartDefinition<'resistor'> = {
  type: 'resistor',
  label: 'Resistor',
  category: 'passives',
  size: { width: 60, height: 20 },
  defaultProps: { resistanceOhms: 220 },
  pins: [pin('lead1', '1', { x: 0, y: 10 }), pin('lead2', '2', { x: 60, y: 10 })],
  propFields: [
    {
      kind: 'number',
      key: 'resistanceOhms',
      label: 'Resistance',
      min: 1,
      max: 1_000_000,
      step: 1,
      unit: 'Ω',
    },
  ],
}

export const pushButtonDefinition: PartDefinition<'push-button'> = {
  type: 'push-button',
  label: 'Push Button',
  category: 'inputs',
  size: { width: 40, height: 40 },
  defaultProps: {},
  pins: [pin('1', '1', { x: 0, y: 20 }), pin('2', '2', { x: 40, y: 20 })],
  propFields: [],
}

export const potentiometerDefinition: PartDefinition<'potentiometer'> = {
  type: 'potentiometer',
  label: 'Potentiometer',
  category: 'inputs',
  size: { width: 60, height: 40 },
  defaultProps: { resistanceOhms: 10_000 },
  pins: [
    pin('1', '1', { x: 0, y: 20 }),
    pin('2', 'W', { x: 30, y: 40 }),
    pin('3', '3', { x: 60, y: 20 }),
  ],
  propFields: [
    {
      kind: 'number',
      key: 'resistanceOhms',
      label: 'Resistance',
      min: 1,
      max: 1_000_000,
      step: 1,
      unit: 'Ω',
    },
  ],
}

export const buzzerDefinition: PartDefinition<'buzzer'> = {
  type: 'buzzer',
  label: 'Buzzer',
  category: 'outputs',
  size: { width: 40, height: 40 },
  defaultProps: {},
  pins: [pin('plus', '+', { x: 10, y: 40 }), pin('minus', '-', { x: 30, y: 40 })],
  propFields: [],
}

export const capacitorDefinition: PartDefinition<'capacitor'> = {
  type: 'capacitor',
  label: 'Capacitor',
  category: 'passives',
  size: { width: 40, height: 40 },
  defaultProps: { capacitanceMicroFarads: 100 },
  pins: [pin('1', '+', { x: 10, y: 40 }), pin('2', '−', { x: 30, y: 40 })],
  propFields: [
    {
      kind: 'number',
      key: 'capacitanceMicroFarads',
      label: 'Capacitance',
      min: 1,
      max: 1_000_000,
      step: 1,
      unit: 'µF',
    },
  ],
}

export const diodeDefinition: PartDefinition<'diode'> = {
  type: 'diode',
  label: 'Diode',
  category: 'passives',
  size: { width: 50, height: 24 },
  defaultProps: {},
  pins: [pin('anode', 'A', { x: 0, y: 12 }), pin('cathode', 'K', { x: 50, y: 12 })],
  propFields: [],
}

export const inductorDefinition: PartDefinition<'inductor'> = {
  type: 'inductor',
  label: 'Inductor',
  category: 'passives',
  size: { width: 60, height: 26 },
  defaultProps: { inductanceMilliHenries: 10 },
  pins: [pin('1', '1', { x: 0, y: 13 }), pin('2', '2', { x: 60, y: 13 })],
  propFields: [
    {
      kind: 'number',
      key: 'inductanceMilliHenries',
      label: 'Inductance',
      min: 1,
      max: 1_000_000,
      step: 1,
      unit: 'mH',
    },
  ],
}

export const slideSwitchDefinition: PartDefinition<'slide-switch'> = {
  type: 'slide-switch',
  label: 'Slide Switch',
  category: 'inputs',
  size: { width: 56, height: 30 },
  defaultProps: {},
  pins: [pin('1', '1', { x: 0, y: 15 }), pin('2', '2', { x: 56, y: 15 })],
  propFields: [],
}

export const ldrDefinition: PartDefinition<'ldr'> = {
  type: 'ldr',
  label: 'Photoresistor',
  category: 'inputs',
  size: { width: 44, height: 44 },
  defaultProps: {},
  pins: [pin('1', '1', { x: 10, y: 44 }), pin('2', '2', { x: 34, y: 44 })],
  propFields: [],
}

const RGB_CHANNELS = ['red', 'green', 'blue'] as const

export const rgbLedDefinition: PartDefinition<'rgb-led'> = {
  type: 'rgb-led',
  label: 'RGB LED',
  category: 'outputs',
  size: { width: 44, height: 52 },
  defaultProps: {},
  pins: [
    ...RGB_CHANNELS.map((channel, index) =>
      pin(channel, channel[0]!.toUpperCase(), { x: 8 + index * 10, y: 52 })
    ),
    pin('cathode', 'K', { x: 38, y: 52 }),
  ],
  propFields: [],
}

const SEVEN_SEGMENT_PINS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const

export const sevenSegmentDefinition: PartDefinition<'seven-segment'> = {
  type: 'seven-segment',
  label: '7-Segment Display',
  category: 'outputs',
  size: { width: 70, height: 90 },
  defaultProps: { color: 'red' },
  pins: [
    ...SEVEN_SEGMENT_PINS.map((segment, index) =>
      pin(segment, segment, { x: 8 + index * 8, y: 90 })
    ),
    pin('common', 'CC', { x: 4, y: 90 }),
  ],
  propFields: [
    {
      kind: 'select',
      key: 'color',
      label: 'Color',
      options: ['red', 'green', 'blue', 'yellow', 'white'] satisfies readonly LedColor[],
    },
  ],
}

export const dcMotorDefinition: PartDefinition<'dc-motor'> = {
  type: 'dc-motor',
  label: 'DC Motor',
  category: 'outputs',
  size: { width: 56, height: 56 },
  defaultProps: {},
  pins: [pin('plus', '+', { x: 14, y: 56 }), pin('minus', '-', { x: 42, y: 56 })],
  propFields: [],
}

export const batteryAaDefinition: PartDefinition<'battery-aa'> = {
  type: 'battery-aa',
  label: 'AA Battery',
  category: 'boards',
  size: { width: 64, height: 30 },
  defaultProps: {},
  pins: [pin('plus', '+', { x: 64, y: 15 }), pin('minus', '−', { x: 0, y: 15 })],
  propFields: [],
}

export const batteryNineVoltDefinition: PartDefinition<'battery-9v'> = {
  type: 'battery-9v',
  label: '9V Battery',
  category: 'boards',
  size: { width: 56, height: 40 },
  defaultProps: {},
  pins: [pin('plus', '+', { x: 44, y: 0 }), pin('minus', '−', { x: 12, y: 0 })],
  propFields: [],
}

export const powerSupplyDefinition: PartDefinition<'power-supply'> = {
  type: 'power-supply',
  label: '5V Supply',
  category: 'boards',
  size: { width: 60, height: 44 },
  defaultProps: {},
  pins: [pin('plus', '+5V', { x: 48, y: 0 }), pin('minus', 'GND', { x: 12, y: 0 })],
  propFields: [],
}

const UNO_DIGITAL_PINS = [
  'D13',
  'D12',
  'D11',
  'D10',
  'D9',
  'D8',
  'D7',
  'D6',
  'D5',
  'D4',
  'D3',
  'D2',
  'D1',
  'D0',
] as const

const UNO_POWER_ANALOG_PINS: readonly { id: string; kind: PinKind }[] = [
  { id: 'VIN', kind: 'power' },
  { id: '3V3', kind: 'power' },
  { id: '5V', kind: 'power' },
  { id: 'GND', kind: 'ground' },
  { id: 'GND2', kind: 'ground' },
  { id: 'A0', kind: 'analog' },
  { id: 'A1', kind: 'analog' },
  { id: 'A2', kind: 'analog' },
  { id: 'A3', kind: 'analog' },
  { id: 'A4', kind: 'analog' },
  { id: 'A5', kind: 'analog' },
]

function buildUnoPins(): readonly PartPin[] {
  const digital = UNO_DIGITAL_PINS.map((id, index) =>
    pin(id, id.replace('D', ''), { x: 20 + index * 20, y: 0 }, 'digital')
  )

  const powerAndAnalog = UNO_POWER_ANALOG_PINS.map((entry, index) =>
    pin(entry.id, entry.id.replace('GND2', 'GND'), { x: 20 + index * 20, y: 200 }, entry.kind)
  )

  return [...digital, ...powerAndAnalog]
}

export const arduinoUnoDefinition: PartDefinition<'arduino-uno'> = {
  type: 'arduino-uno',
  label: 'Arduino Uno R3',
  category: 'boards',
  size: { width: 300, height: 200 },
  defaultProps: {},
  pins: buildUnoPins(),
  propFields: [],
}

/**
 * The 830-point breadboard is modelled as 30 columns split into two halves plus
 * the four power rails. Each column half is one internal net of five holes, and
 * every rail is a single net shared by its 30 holes.
 */
export const BREADBOARD_COLUMNS = 30
export const BREADBOARD_TOP_ROWS = ['a', 'b', 'c', 'd', 'e'] as const
export const BREADBOARD_BOTTOM_ROWS = ['f', 'g', 'h', 'i', 'j'] as const

const BREADBOARD_COLUMN_PITCH = 10
const BREADBOARD_FIRST_COLUMN_X = 30
const BREADBOARD_ROW_PITCH = 10
const BREADBOARD_TOP_ROW_Y = 60
const BREADBOARD_BOTTOM_ROW_Y = 120
const BREADBOARD_TOP_PLUS_Y = 20
const BREADBOARD_TOP_MINUS_Y = 30
const BREADBOARD_BOTTOM_PLUS_Y = 190
const BREADBOARD_BOTTOM_MINUS_Y = 200

/**
 * Body geometry derived from the pin grid, so the drawn board can never drift
 * away from where the holes actually are.
 */
export const BREADBOARD_LAYOUT = {
  size: { width: 360, height: 220 } satisfies Size,
  firstColumnX: BREADBOARD_FIRST_COLUMN_X,
  columnPitch: BREADBOARD_COLUMN_PITCH,
  rails: [
    { y: BREADBOARD_TOP_PLUS_Y, color: '#c0392b' },
    { y: BREADBOARD_TOP_MINUS_Y, color: '#2563eb' },
    { y: BREADBOARD_BOTTOM_PLUS_Y, color: '#c0392b' },
    { y: BREADBOARD_BOTTOM_MINUS_Y, color: '#2563eb' },
  ],
  halves: [
    { top: BREADBOARD_TOP_ROW_Y - 8, bottom: BREADBOARD_TOP_ROW_Y + 48 },
    { top: BREADBOARD_BOTTOM_ROW_Y - 8, bottom: BREADBOARD_BOTTOM_ROW_Y + 48 },
  ],
} as const

export function breadboardColumnX(column: number): number {
  return BREADBOARD_FIRST_COLUMN_X + (column - 1) * BREADBOARD_COLUMN_PITCH
}

function breadboardRowY(rowIndex: number, firstRowY: number): number {
  return firstRowY + (rowIndex - 1) * BREADBOARD_ROW_PITCH
}

function buildBreadboardPins(): readonly PartPin[] {
  const pins: PartPin[] = []

  for (let column = 1; column <= BREADBOARD_COLUMNS; column += 1) {
    const x = breadboardColumnX(column)
    for (const [index, row] of BREADBOARD_TOP_ROWS.entries()) {
      pins.push(
        pin(`${row}${column}`, `${row}${column}`, {
          x,
          y: breadboardRowY(index + 1, BREADBOARD_TOP_ROW_Y),
        })
      )
    }
    for (const [index, row] of BREADBOARD_BOTTOM_ROWS.entries()) {
      pins.push(
        pin(`${row}${column}`, `${row}${column}`, {
          x,
          y: breadboardRowY(index + 1, BREADBOARD_BOTTOM_ROW_Y),
        })
      )
    }
  }

  const rails = [
    { prefix: 'top-plus', label: '+', y: BREADBOARD_TOP_PLUS_Y, kind: 'power' as PinKind },
    { prefix: 'top-minus', label: '−', y: BREADBOARD_TOP_MINUS_Y, kind: 'ground' as PinKind },
    {
      prefix: 'bottom-plus',
      label: '+',
      y: BREADBOARD_BOTTOM_PLUS_Y,
      kind: 'power' as PinKind,
    },
    {
      prefix: 'bottom-minus',
      label: '−',
      y: BREADBOARD_BOTTOM_MINUS_Y,
      kind: 'ground' as PinKind,
    },
  ]

  for (const rail of rails) {
    for (let column = 1; column <= BREADBOARD_COLUMNS; column += 1) {
      pins.push(
        pin(
          `${rail.prefix}-${column}`,
          rail.label,
          { x: breadboardColumnX(column), y: rail.y },
          rail.kind
        )
      )
    }
  }

  return pins
}

function buildBreadboardInternalNets(): readonly (readonly string[])[] {
  const nets: string[][] = []

  for (let column = 1; column <= BREADBOARD_COLUMNS; column += 1) {
    nets.push(BREADBOARD_TOP_ROWS.map((row) => `${row}${column}`))
    nets.push(BREADBOARD_BOTTOM_ROWS.map((row) => `${row}${column}`))
  }

  for (const prefix of ['top-plus', 'top-minus', 'bottom-plus', 'bottom-minus']) {
    nets.push(
      Array.from({ length: BREADBOARD_COLUMNS }, (_unused, index) => `${prefix}-${index + 1}`)
    )
  }

  return nets
}

export const breadboardDefinition: PartDefinition<'breadboard'> = {
  type: 'breadboard',
  label: 'Breadboard',
  category: 'boards',
  size: BREADBOARD_LAYOUT.size,
  defaultProps: {},
  pins: buildBreadboardPins(),
  internalNets: buildBreadboardInternalNets(),
  propFields: [],
}

export const partDefinitions = [
  arduinoUnoDefinition,
  breadboardDefinition,
  ledDefinition,
  resistorDefinition,
  pushButtonDefinition,
  potentiometerDefinition,
  buzzerDefinition,
  capacitorDefinition,
  diodeDefinition,
  inductorDefinition,
  slideSwitchDefinition,
  ldrDefinition,
  rgbLedDefinition,
  sevenSegmentDefinition,
  dcMotorDefinition,
  batteryAaDefinition,
  batteryNineVoltDefinition,
  powerSupplyDefinition,
] as const

const definitionsByType = new Map<PartType, PartDefinition>(
  partDefinitions.map((definition) => [definition.type, definition])
)

export function definitionOf(type: PartType): PartDefinition {
  const definition = definitionsByType.get(type)
  if (definition === undefined) {
    throw new Error(`No part definition registered for type "${type}"`)
  }
  return definition
}

export function sizeOf(type: PartType): Size {
  return definitionOf(type).size
}

export function pinOf(type: PartType, pinId: string): PartPin {
  const found = definitionOf(type).pins.find((candidate) => candidate.id === pinId)
  if (found === undefined) {
    throw new Error(`Part "${type}" has no pin "${pinId}"`)
  }
  return found
}

/** Absolute world position of a pin, accounting for the part's rotation. */
export function pinWorldPosition(part: PartInstance, pinId: string): Point {
  const definition = definitionOf(part.type)
  const local = pinOf(part.type, pinId)
  const rotated = rotateOffset(local.position, part.rotation, definition.size)
  return { x: part.position.x + rotated.x, y: part.position.y + rotated.y }
}
