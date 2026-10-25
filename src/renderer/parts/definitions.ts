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

export interface SensorSpec {
  readonly label: string
  readonly min: number
  readonly max: number
  readonly unit?: string
  readonly step?: number
  readonly control?: 'slider' | 'toggle'
}

export interface PartDefinition<Type extends PartType = PartType> {
  readonly type: Type
  readonly label: string
  readonly category: 'boards' | 'outputs' | 'inputs' | 'passives'
  readonly size: Size
  readonly defaultProps: PartPropsMap[Type]
  readonly pins: readonly PartPin[]
  /** Widens the measured label box for unusually dense headers. */
  readonly pinLabelCharWidthFactor?: number
  /** Draws header pins as square pads instead of generic round terminals. */
  readonly pinStyle?: 'header'
  /** Extra inward offset for printed header labels, clear of the plastic strip. */
  readonly pinLabelInset?: number
  /**
   * Pin groups that are connected inside the part itself and must therefore end
   * up in the same net (breadboard strips and rails, switch contacts, ...).
   */
  readonly internalNets?: readonly (readonly string[])[]
  readonly sensor?: SensorSpec
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
  sensor: { label: 'Light', min: 0, max: 100, unit: '%' },
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

/** A real 10-pin display has five leads on each edge, not nine in one row. */
const SEVEN_SEGMENT_TOP_PINS = ['a', 'b', 'c', 'd', 'e'] as const
const SEVEN_SEGMENT_BOTTOM_PINS = ['f', 'g', 'dp', 'common', 'common2'] as const

function sevenSegmentPinLabel(id: string): string {
  if (id === 'common' || id === 'common2') return 'CC'
  if (id === 'dp') return 'DP'
  return id
}

function sevenSegmentPins(): readonly PartPin[] {
  const edge = (pins: readonly string[], y: number): readonly PartPin[] =>
    pins.map((id, index) => pin(id, sevenSegmentPinLabel(id), { x: 7 + index * 14, y }))
  return [...edge(SEVEN_SEGMENT_TOP_PINS, 0), ...edge(SEVEN_SEGMENT_BOTTOM_PINS, 90)]
}

export const sevenSegmentDefinition: PartDefinition<'seven-segment'> = {
  type: 'seven-segment',
  label: '7-Segment Display',
  category: 'outputs',
  size: { width: 70, height: 90 },
  defaultProps: { color: 'red' },
  pins: sevenSegmentPins(),
  internalNets: [['common', 'common2']],
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

/** Uno R3 pins wired to a timer output; the board prints them with a leading ~. */
const UNO_PWM_PINS = new Set(['D3', 'D5', 'D6', 'D9', 'D10', 'D11'])

const UNO_DIGITAL_LEFT_PINS = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'] as const

const UNO_DIGITAL_RIGHT_PINS = ['D8', 'D9', 'D10', 'D11', 'D12', 'D13'] as const

const UNO_POWER_PINS: readonly { id: string; kind: PinKind }[] = [
  { id: '3V3', kind: 'power' },
  { id: '5V', kind: 'power' },
  { id: 'GND', kind: 'ground' },
  { id: 'GND2', kind: 'ground' },
  { id: 'VIN', kind: 'power' },
]

const UNO_ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] as const

function buildUnoPins(): readonly PartPin[] {
  const labelFor = (id: string): string =>
    `${UNO_PWM_PINS.has(id) ? '~' : ''}${id.replace('D', '')}`
  const digitalLeft = UNO_DIGITAL_LEFT_PINS.map((id, index) =>
    pin(id, labelFor(id), { x: 18 + index * 20, y: 0 }, 'digital')
  )
  const digitalRight = UNO_DIGITAL_RIGHT_PINS.map((id, index) =>
    pin(id, labelFor(id), { x: 178 + index * 20, y: 0 }, 'digital')
  )
  const power = UNO_POWER_PINS.map((entry, index) =>
    pin(entry.id, entry.id.replace('GND2', 'GND'), { x: 18 + index * 20, y: 200 }, entry.kind)
  )
  const analog = UNO_ANALOG_PINS.map((id, index) =>
    pin(id, id, { x: 178 + index * 20, y: 200 }, 'analog')
  )
  return [...digitalLeft, ...digitalRight, ...power, ...analog]
}

export const arduinoUnoDefinition: PartDefinition<'arduino-uno'> = {
  type: 'arduino-uno',
  label: 'Arduino Uno R3',
  category: 'boards',
  size: { width: 300, height: 200 },
  defaultProps: {},
  pins: buildUnoPins(),
  pinStyle: 'header',
  pinLabelInset: 9,
  propFields: [],
}

/**
 * The Raspberry Pi 4's 40-pin header, numbered as on the physical board. The
 * board is a wiring target rather than a second CPU: its GPIO pins are passive
 * nets and the repeated 5V, 3V3 and GND pins are tied together internally.
 */
const RASPBERRY_PI_HEADER_PINS = [
  { physical: 1, id: '3V3-1', label: '3V3', kind: 'power' },
  { physical: 2, id: '5V-2', label: '5V', kind: 'power' },
  { physical: 3, id: 'GPIO2-3', label: 'GP2', kind: 'digital' },
  { physical: 4, id: '5V-4', label: '5V', kind: 'power' },
  { physical: 5, id: 'GPIO3-5', label: 'GP3', kind: 'digital' },
  { physical: 6, id: 'GND-6', label: 'GND', kind: 'ground' },
  { physical: 7, id: 'GPIO4-7', label: 'GP4', kind: 'digital' },
  { physical: 8, id: 'GPIO14-8', label: 'GP14', kind: 'digital' },
  { physical: 9, id: 'GND-9', label: 'GND', kind: 'ground' },
  { physical: 10, id: 'GPIO15-10', label: 'GP15', kind: 'digital' },
  { physical: 11, id: 'GPIO17-11', label: 'GP17', kind: 'digital' },
  { physical: 12, id: 'GPIO18-12', label: 'GP18', kind: 'digital' },
  { physical: 13, id: 'GPIO27-13', label: 'GP27', kind: 'digital' },
  { physical: 14, id: 'GND-14', label: 'GND', kind: 'ground' },
  { physical: 15, id: 'GPIO22-15', label: 'GP22', kind: 'digital' },
  { physical: 16, id: 'GPIO23-16', label: 'GP23', kind: 'digital' },
  { physical: 17, id: '3V3-17', label: '3V3', kind: 'power' },
  { physical: 18, id: 'GPIO24-18', label: 'GP24', kind: 'digital' },
  { physical: 19, id: 'GPIO10-19', label: 'GP10', kind: 'digital' },
  { physical: 20, id: 'GND-20', label: 'GND', kind: 'ground' },
  { physical: 21, id: 'GPIO9-21', label: 'GP9', kind: 'digital' },
  { physical: 22, id: 'GPIO25-22', label: 'GP25', kind: 'digital' },
  { physical: 23, id: 'GPIO11-23', label: 'GP11', kind: 'digital' },
  { physical: 24, id: 'GPIO8-24', label: 'GP8', kind: 'digital' },
  { physical: 25, id: 'GND-25', label: 'GND', kind: 'ground' },
  { physical: 26, id: 'GPIO7-26', label: 'GP7', kind: 'digital' },
  { physical: 27, id: 'GPIO0-27', label: 'GP0', kind: 'digital' },
  { physical: 28, id: 'GPIO1-28', label: 'GP1', kind: 'digital' },
  { physical: 29, id: 'GPIO5-29', label: 'GP5', kind: 'digital' },
  { physical: 30, id: 'GND-30', label: 'GND', kind: 'ground' },
  { physical: 31, id: 'GPIO6-31', label: 'GP6', kind: 'digital' },
  { physical: 32, id: 'GPIO12-32', label: 'GP12', kind: 'digital' },
  { physical: 33, id: 'GPIO13-33', label: 'GP13', kind: 'digital' },
  { physical: 34, id: 'GND-34', label: 'GND', kind: 'ground' },
  { physical: 35, id: 'GPIO19-35', label: 'GP19', kind: 'digital' },
  { physical: 36, id: 'GPIO16-36', label: 'GP16', kind: 'digital' },
  { physical: 37, id: 'GPIO26-37', label: 'GP26', kind: 'digital' },
  { physical: 38, id: 'GPIO20-38', label: 'GP20', kind: 'digital' },
  { physical: 39, id: 'GND-39', label: 'GND', kind: 'ground' },
  { physical: 40, id: 'GPIO21-40', label: 'GP21', kind: 'digital' },
] as const satisfies readonly {
  readonly physical: number
  readonly id: string
  readonly label: string
  readonly kind: PinKind
}[]

const RASPBERRY_PI_HEADER_X = 44
const RASPBERRY_PI_HEADER_Y = 4
const RASPBERRY_PI_HEADER_PITCH = 26
const RASPBERRY_PI_HEADER_ROW_PITCH = 26

function buildRaspberryPiPins(): readonly PartPin[] {
  return RASPBERRY_PI_HEADER_PINS.map((entry) => {
    const index = entry.physical - 1
    return pin(
      entry.id,
      entry.label,
      {
        x: RASPBERRY_PI_HEADER_X + Math.floor(index / 2) * RASPBERRY_PI_HEADER_PITCH,
        y: RASPBERRY_PI_HEADER_Y + (index % 2) * RASPBERRY_PI_HEADER_ROW_PITCH,
      },
      entry.kind
    )
  })
}

function raspberryPiInternalNets(): readonly (readonly string[])[] {
  const idsFor = (label: string): readonly string[] =>
    RASPBERRY_PI_HEADER_PINS.filter((entry) => entry.label === label).map((entry) => entry.id)
  return [idsFor('3V3'), idsFor('5V'), idsFor('GND')]
}

export const raspberryPiDefinition: PartDefinition<'raspberry-pi'> = {
  type: 'raspberry-pi',
  label: 'Raspberry Pi 4',
  category: 'boards',
  size: { width: 560, height: 220 },
  defaultProps: {},
  pins: buildRaspberryPiPins(),
  pinStyle: 'header',
  pinLabelCharWidthFactor: 0.78,
  internalNets: raspberryPiInternalNets(),
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

export const electrolyticCapacitorDefinition: PartDefinition<'electrolytic-capacitor'> = {
  type: 'electrolytic-capacitor',
  label: 'Electrolytic Capacitor',
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

export const zenerDiodeDefinition: PartDefinition<'zener-diode'> = {
  type: 'zener-diode',
  label: 'Zener Diode',
  category: 'passives',
  size: { width: 50, height: 24 },
  defaultProps: { zenerVoltage: 5.1 },
  pins: [pin('anode', 'A', { x: 0, y: 12 }), pin('cathode', 'K', { x: 50, y: 12 })],
  propFields: [
    {
      kind: 'number',
      key: 'zenerVoltage',
      label: 'Breakdown voltage',
      min: 2,
      max: 30,
      step: 0.1,
      unit: 'V',
    },
  ],
}

export const lightBulbDefinition: PartDefinition<'light-bulb'> = {
  type: 'light-bulb',
  label: 'Light Bulb',
  category: 'outputs',
  size: { width: 44, height: 44 },
  defaultProps: { ratedVolts: 5, resistanceOhms: 100 },
  pins: [pin('1', '1', { x: 12, y: 44 }), pin('2', '2', { x: 32, y: 44 })],
  propFields: [
    {
      kind: 'number',
      key: 'ratedVolts',
      label: 'Rated voltage',
      min: 1.5,
      max: 24,
      step: 0.5,
      unit: 'V',
    },
    {
      kind: 'number',
      key: 'resistanceOhms',
      label: 'Resistance',
      min: 10,
      max: 100_000,
      step: 10,
      unit: 'Ω',
    },
  ],
}

export const vibrationMotorDefinition: PartDefinition<'vibration-motor'> = {
  type: 'vibration-motor',
  label: 'Vibration Motor',
  category: 'outputs',
  size: { width: 44, height: 44 },
  defaultProps: {},
  pins: [pin('plus', '+', { x: 12, y: 44 }), pin('minus', '-', { x: 32, y: 44 })],
  propFields: [],
}

export const gearMotorDefinition: PartDefinition<'gear-motor'> = {
  type: 'gear-motor',
  label: 'Gear Motor',
  category: 'outputs',
  size: { width: 60, height: 50 },
  defaultProps: {},
  pins: [pin('plus', '+', { x: 18, y: 50 }), pin('minus', '-', { x: 42, y: 50 })],
  propFields: [],
}

export const thermistorDefinition: PartDefinition<'thermistor'> = {
  type: 'thermistor',
  label: 'Thermistor',
  category: 'inputs',
  size: { width: 44, height: 44 },
  defaultProps: {},
  pins: [pin('1', '1', { x: 10, y: 44 }), pin('2', '2', { x: 34, y: 44 })],
  sensor: { label: 'Temperature', min: -40, max: 125, unit: '°C', step: 1 },
  propFields: [],
}

export const flexSensorDefinition: PartDefinition<'flex-sensor'> = {
  type: 'flex-sensor',
  label: 'Flex Sensor',
  category: 'inputs',
  size: { width: 60, height: 26 },
  defaultProps: {},
  pins: [pin('1', '1', { x: 0, y: 13 }), pin('2', '2', { x: 60, y: 13 })],
  sensor: { label: 'Bend', min: 0, max: 180, unit: '°', step: 1 },
  propFields: [],
}

export const forceSensorDefinition: PartDefinition<'force-sensor'> = {
  type: 'force-sensor',
  label: 'Force Sensor',
  category: 'inputs',
  size: { width: 44, height: 44 },
  defaultProps: {},
  pins: [pin('1', '1', { x: 10, y: 44 }), pin('2', '2', { x: 34, y: 44 })],
  sensor: { label: 'Force', min: 0, max: 10, unit: 'N', step: 0.1 },
  propFields: [],
}

export const photodiodeDefinition: PartDefinition<'photodiode'> = {
  type: 'photodiode',
  label: 'Photodiode',
  category: 'inputs',
  size: { width: 50, height: 24 },
  defaultProps: {},
  pins: [pin('anode', 'A', { x: 0, y: 12 }), pin('cathode', 'K', { x: 50, y: 12 })],
  sensor: { label: 'Light', min: 0, max: 100, unit: '%', step: 1 },
  propFields: [],
}

export const phototransistorDefinition: PartDefinition<'phototransistor'> = {
  type: 'phototransistor',
  label: 'Phototransistor',
  category: 'inputs',
  size: { width: 50, height: 34 },
  defaultProps: {},
  pins: [pin('collector', 'C', { x: 12, y: 34 }), pin('emitter', 'E', { x: 38, y: 34 })],
  sensor: { label: 'Light', min: 0, max: 100, unit: '%', step: 1 },
  propFields: [],
}

export const tiltSensorDefinition: PartDefinition<'tilt-sensor'> = {
  type: 'tilt-sensor',
  label: 'Tilt Sensor',
  category: 'inputs',
  size: { width: 40, height: 40 },
  defaultProps: {},
  pins: [pin('1', '1', { x: 10, y: 40 }), pin('2', '2', { x: 30, y: 40 })],
  sensor: { label: 'Tilt', min: 0, max: 90, unit: '°', step: 1 },
  propFields: [],
}

export const soilMoistureDefinition: PartDefinition<'soil-moisture'> = {
  type: 'soil-moisture',
  label: 'Soil Moisture',
  category: 'inputs',
  size: { width: 50, height: 50 },
  defaultProps: {},
  pins: [
    pin('vcc', 'V+', { x: 8, y: 50 }, 'power'),
    pin('sig', 'SIG', { x: 25, y: 50 }, 'analog'),
    pin('gnd', 'G', { x: 42, y: 50 }, 'ground'),
  ],
  sensor: { label: 'Moisture', min: 0, max: 100, unit: '%', step: 1 },
  propFields: [],
}

export const gasSensorDefinition: PartDefinition<'gas-sensor'> = {
  type: 'gas-sensor',
  label: 'Gas Sensor',
  category: 'inputs',
  size: { width: 60, height: 50 },
  defaultProps: {},
  pins: [
    pin('h1', 'H', { x: 10, y: 0 }),
    pin('h2', 'H', { x: 50, y: 0 }),
    pin('a1', 'A', { x: 0, y: 16 }),
    pin('a2', 'A', { x: 0, y: 34 }),
    pin('b1', 'B', { x: 60, y: 16 }),
    pin('b2', 'B', { x: 60, y: 34 }),
  ],
  internalNets: [
    ['a1', 'a2'],
    ['b1', 'b2'],
  ],
  sensor: { label: 'Gas', min: 0, max: 1000, unit: 'ppm', step: 1 },
  propFields: [],
}

export const tmp36Definition: PartDefinition<'tmp36'> = {
  type: 'tmp36',
  label: 'TMP36 Sensor',
  category: 'inputs',
  size: { width: 56, height: 50 },
  defaultProps: {},
  pins: [
    pin('vcc', 'V+', { x: 8, y: 50 }, 'power'),
    pin('vout', 'OUT', { x: 28, y: 50 }, 'analog'),
    pin('gnd', 'G', { x: 48, y: 50 }, 'ground'),
  ],
  sensor: { label: 'Temperature', min: -40, max: 125, unit: '°C', step: 1 },
  propFields: [],
}

export const coinCellDefinition: PartDefinition<'coin-cell'> = {
  type: 'coin-cell',
  label: 'Coin Cell 3V',
  category: 'boards',
  size: { width: 40, height: 36 },
  defaultProps: {},
  pins: [pin('plus', '+', { x: 40, y: 18 }), pin('minus', '−', { x: 0, y: 18 })],
  propFields: [],
}

export const solarCellDefinition: PartDefinition<'solar-cell'> = {
  type: 'solar-cell',
  label: 'Solar Cell',
  category: 'boards',
  size: { width: 60, height: 40 },
  defaultProps: {},
  pins: [pin('plus', '+', { x: 60, y: 20 }), pin('minus', '−', { x: 0, y: 20 })],
  sensor: { label: 'Sunlight', min: 0, max: 100, unit: '%', step: 1 },
  propFields: [],
}

export const potatoBatteryDefinition: PartDefinition<'potato-battery'> = {
  type: 'potato-battery',
  label: 'Potato Battery',
  category: 'boards',
  size: { width: 60, height: 50 },
  defaultProps: {},
  pins: [pin('plus', '+', { x: 60, y: 25 }), pin('minus', '−', { x: 0, y: 25 })],
  propFields: [],
}

function dipPins(count: number, width: number): readonly PartPin[] {
  const pitch = (width - 20) / Math.max(1, count - 1)
  return Array.from({ length: count }, (_unused, index) => {
    const x = 10 + index * pitch
    return [
      pin(`top${index + 1}`, `${index + 1}`, { x, y: 0 }),
      pin(`bottom${index + 1}`, `${index + 1}`, { x, y: 36 }),
    ]
  }).flat()
}

export const dipSwitch4Definition: PartDefinition<'dip-switch-4'> = {
  type: 'dip-switch-4',
  label: 'DIP Switch x4',
  category: 'inputs',
  size: { width: 80, height: 36 },
  defaultProps: {},
  pins: dipPins(4, 80),
  propFields: [],
}

export const dipSwitch6Definition: PartDefinition<'dip-switch-6'> = {
  type: 'dip-switch-6',
  label: 'DIP Switch x6',
  category: 'inputs',
  size: { width: 100, height: 36 },
  defaultProps: {},
  pins: dipPins(6, 100),
  propFields: [],
}

export const lm7805Definition: PartDefinition<'lm7805'> = {
  type: 'lm7805',
  label: 'LM7805 Regulator',
  category: 'boards',
  size: { width: 60, height: 40 },
  defaultProps: {},
  pins: [
    pin('in', 'IN', { x: 0, y: 20 }, 'power'),
    pin('gnd', 'GND', { x: 30, y: 40 }, 'ground'),
    pin('out', 'OUT', { x: 60, y: 20 }, 'power'),
  ],
  propFields: [],
}

export const ld1117v33Definition: PartDefinition<'ld1117v33'> = {
  type: 'ld1117v33',
  label: 'LD1117V33 Regulator',
  category: 'boards',
  size: { width: 60, height: 40 },
  defaultProps: {},
  pins: [
    pin('in', 'IN', { x: 0, y: 20 }, 'power'),
    pin('gnd', 'GND', { x: 30, y: 40 }, 'ground'),
    pin('out', 'OUT', { x: 60, y: 20 }, 'power'),
  ],
  propFields: [],
}

function genericPart(
  type: PartType,
  label: string,
  category: PartDefinition['category'],
  size: Size,
  pins: readonly PartPin[],
  options: {
    readonly sensor?: SensorSpec
    readonly internalNets?: readonly (readonly string[])[]
    readonly propFields?: readonly PropField[]
  } = {}
): PartDefinition {
  return {
    type,
    label,
    category,
    size,
    defaultProps: {} as PartPropsMap[PartType],
    pins,
    ...options,
    propFields: options.propFields ?? [],
  }
}

function dipHeight(pinCount: number): number {
  return Math.max(56, Math.ceil(pinCount / 2) * 12 + 16)
}

function dipPart(
  type: PartType,
  label: string,
  pinCount: number,
  labels: readonly string[] = []
): PartDefinition {
  const rows = Math.ceil(pinCount / 2)
  const height = dipHeight(pinCount)
  const pins: PartPin[] = []
  for (let row = 0; row < rows; row += 1) {
    const y = 8 + row * 12
    const leftNumber = row + 1
    const rightNumber = pinCount - row
    pins.push(pin(String(leftNumber), labels[leftNumber - 1] ?? String(leftNumber), { x: 0, y }))
    if (rightNumber !== leftNumber) {
      pins.push(
        pin(String(rightNumber), labels[rightNumber - 1] ?? String(rightNumber), {
          x: 110,
          y,
        })
      )
    }
  }
  return genericPart(type, label, 'boards', { width: 110, height }, pins)
}

function gatePart(
  type: PartType,
  label: string,
  pinCount: number,
  _gates: readonly (readonly number[])[],
  labels: readonly string[]
): PartDefinition {
  return dipPart(
    type,
    label,
    pinCount,
    Array.from({ length: pinCount }, (_unused, index) => labels[index] ?? String(index + 1))
  )
}

const QUAD_2_INPUT = [
  [1, 2, 3],
  [4, 5, 6],
  [9, 10, 8],
  [12, 13, 11],
] as const
const HEX_INVERTER = [
  [1, 2],
  [3, 4],
  [5, 6],
  [9, 8],
  [11, 10],
  [13, 12],
] as const
const TRIPLE_3_INPUT = [
  [1, 2, 13, 12],
  [3, 4, 5, 6],
  [9, 10, 11, 8],
] as const
const DUAL_4_INPUT = [
  [1, 2, 4, 5, 6],
  [9, 10, 12, 13, 8],
] as const
const GATE_14_LABELS = [
  '1A',
  '1B',
  '1Y',
  '2A',
  '2B',
  '2Y',
  'GND',
  '3Y',
  '3A',
  '3B',
  '4Y',
  '4A',
  '4B',
  'VCC',
]
const GATE_14_SINGLE_LABELS = [
  '1A',
  '1Y',
  '2A',
  '2Y',
  '3A',
  '3Y',
  'GND',
  '4Y',
  '4A',
  '5Y',
  '5A',
  '6Y',
  '6A',
  'VCC',
]
const GATE_TRIPLE_LABELS = [
  '1A',
  '1B',
  '1C',
  '1Y',
  '2A',
  '2B',
  'GND',
  '3Y',
  '3A',
  '3B',
  '3C',
  '3Y',
  '3C',
  'VCC',
]
const GATE_DUAL_4_LABELS = [
  '1A',
  '1B',
  '1C',
  '1D',
  '1Y',
  '2Y',
  'GND',
  '2Y',
  '2A',
  '2B',
  '2C',
  '2D',
  '2Y',
  'VCC',
]

export const irReceiverDefinition = genericPart(
  'ir-receiver',
  'IR Receiver',
  'inputs',
  { width: 50, height: 46 },
  [
    pin('out', 'OUT', { x: 10, y: 46 }, 'digital'),
    pin('gnd', 'GND', { x: 25, y: 46 }, 'ground'),
    pin('vcc', 'VCC', { x: 40, y: 46 }, 'power'),
  ]
)

export const ultrasonic3PinDefinition = genericPart(
  'ultrasonic-3pin',
  'Ultrasonic 3-pin',
  'inputs',
  { width: 64, height: 44 },
  [
    pin('sig', 'SIG', { x: 12, y: 44 }, 'digital'),
    pin('vcc', 'VCC', { x: 32, y: 44 }, 'power'),
    pin('gnd', 'GND', { x: 52, y: 44 }, 'ground'),
  ],
  { sensor: { label: 'Distance', min: 2, max: 400, unit: 'cm', step: 1 } }
)

export const ultrasonicHcsr04Definition = genericPart(
  'ultrasonic-hcsr04',
  'Ultrasonic HC-SR04',
  'inputs',
  { width: 76, height: 44 },
  [
    pin('vcc', 'VCC', { x: 8, y: 44 }, 'power'),
    pin('trig', 'TRIG', { x: 28, y: 44 }, 'digital'),
    pin('echo', 'ECHO', { x: 48, y: 44 }, 'digital'),
    pin('gnd', 'GND', { x: 68, y: 44 }, 'ground'),
  ],
  { sensor: { label: 'Distance', min: 2, max: 400, unit: 'cm', step: 1 } }
)

export const pirSensorDefinition = genericPart(
  'pir-sensor',
  'PIR Motion Sensor',
  'inputs',
  { width: 52, height: 52 },
  [
    pin('vcc', 'VCC', { x: 8, y: 52 }, 'power'),
    pin('out', 'OUT', { x: 26, y: 52 }, 'digital'),
    pin('gnd', 'GND', { x: 44, y: 52 }, 'ground'),
  ],
  { sensor: { label: 'Motion', min: 0, max: 1, step: 1, control: 'toggle' } }
)

export const keypad4x4Definition = genericPart(
  'keypad-4x4',
  'Keypad 4x4',
  'inputs',
  { width: 120, height: 112 },
  [
    ...Array.from({ length: 4 }, (_unused, index) =>
      pin(`r${index + 1}`, `R${index + 1}`, { x: 12 + index * 24, y: 112 }, 'digital')
    ),
    ...Array.from({ length: 4 }, (_unused, index) =>
      pin(`c${index + 1}`, `C${index + 1}`, { x: 12 + index * 24, y: 0 }, 'digital')
    ),
  ]
)

export const neopixelStripDefinition: PartDefinition<'neopixel-strip'> = {
  type: 'neopixel-strip',
  label: 'NeoPixel Strip',
  category: 'outputs',
  size: { width: 130, height: 36 },
  defaultProps: { pixelCount: 8, color: 'green' },
  pins: [
    pin('vdd', 'VDD', { x: 10, y: 36 }, 'power'),
    pin('gnd', 'GND', { x: 30, y: 36 }, 'ground'),
    pin('din', 'DIN', { x: 100, y: 36 }, 'digital'),
    pin('dout', 'DOUT', { x: 120, y: 36 }, 'digital'),
  ],
  propFields: [
    {
      kind: 'number',
      key: 'pixelCount',
      label: 'Pixels',
      min: 4,
      max: 24,
      step: 1,
    },
    {
      kind: 'select',
      key: 'color',
      label: 'Preview color',
      options: ['red', 'green', 'blue', 'yellow', 'white'],
    },
  ],
}

export const neopixelRingDefinition: PartDefinition<'neopixel-ring'> = {
  type: 'neopixel-ring',
  label: 'NeoPixel Ring',
  category: 'outputs',
  size: { width: 96, height: 96 },
  defaultProps: { pixelCount: 12, color: 'blue' },
  pins: [
    pin('vdd', 'VDD', { x: 20, y: 96 }, 'power'),
    pin('gnd', 'GND', { x: 38, y: 96 }, 'ground'),
    pin('din', 'DIN', { x: 58, y: 96 }, 'digital'),
    pin('dout', 'DOUT', { x: 76, y: 96 }, 'digital'),
  ],
  propFields: [
    {
      kind: 'number',
      key: 'pixelCount',
      label: 'Pixels',
      min: 12,
      max: 24,
      step: 1,
    },
    {
      kind: 'select',
      key: 'color',
      label: 'Preview color',
      options: ['red', 'green', 'blue', 'yellow', 'white'],
    },
  ],
}

export const irRemoteDefinition = genericPart(
  'ir-remote',
  'IR Remote',
  'inputs',
  { width: 96, height: 170 },
  []
)

export const encoderMotorDefinition = genericPart(
  'encoder-motor',
  'Motor with Encoder',
  'outputs',
  { width: 76, height: 64 },
  [
    pin('plus', 'M+', { x: 10, y: 64 }, 'power'),
    pin('minus', 'M-', { x: 28, y: 64 }, 'power'),
    pin('vcc', 'VCC', { x: 40, y: 0 }, 'power'),
    pin('gnd', 'GND', { x: 54, y: 0 }, 'ground'),
    pin('a', 'A', { x: 68, y: 0 }, 'digital'),
    pin('b', 'B', { x: 76, y: 20 }, 'digital'),
  ]
)

export const servoDefinition = genericPart(
  'servo',
  'Micro Servo',
  'outputs',
  { width: 64, height: 54 },
  [
    pin('signal', 'SIG', { x: 10, y: 54 }, 'digital'),
    pin('vcc', 'V+', { x: 32, y: 54 }, 'power'),
    pin('gnd', 'G', { x: 54, y: 54 }, 'ground'),
  ]
)

export const lcd16x2Definition = genericPart(
  'lcd-16x2',
  'LCD 16x2',
  'outputs',
  { width: 150, height: 86 },
  [
    pin('vss', 'VSS', { x: 8, y: 86 }, 'ground'),
    pin('vdd', 'VDD', { x: 17, y: 86 }, 'power'),
    pin('v0', 'V0', { x: 26, y: 86 }, 'analog'),
    pin('rs', 'RS', { x: 35, y: 86 }, 'digital'),
    pin('rw', 'RW', { x: 44, y: 86 }, 'digital'),
    pin('e', 'E', { x: 53, y: 86 }, 'digital'),
    ...Array.from({ length: 8 }, (_unused, index) =>
      pin(`d${index}`, `D${index}`, { x: 62 + index * 9, y: 86 }, 'digital')
    ),
    pin('ledPlus', 'LED+', { x: 136, y: 86 }, 'power'),
    pin('ledMinus', 'LED-', { x: 146, y: 86 }, 'ground'),
  ]
)

export const lcd16x2I2cDefinition = genericPart(
  'lcd-16x2-i2c',
  'LCD 16x2 I2C',
  'outputs',
  { width: 120, height: 90 },
  [
    pin('gnd', 'GND', { x: 15, y: 90 }, 'ground'),
    pin('vcc', 'VCC', { x: 40, y: 90 }, 'power'),
    pin('sda', 'SDA', { x: 65, y: 90 }, 'digital'),
    pin('scl', 'SCL', { x: 90, y: 90 }, 'digital'),
  ]
)

export const sevenSegmentClockDefinition = genericPart(
  'seven-segment-clock',
  '7-Segment Clock',
  'outputs',
  { width: 120, height: 54 },
  [
    pin('vcc', 'VCC', { x: 12, y: 54 }, 'power'),
    pin('gnd', 'GND', { x: 34, y: 54 }, 'ground'),
    pin('sda', 'SDA', { x: 56, y: 54 }, 'digital'),
    pin('scl', 'SCL', { x: 78, y: 54 }, 'digital'),
  ]
)

export const microbitDefinition = genericPart(
  'microbit',
  'micro:bit',
  'boards',
  { width: 120, height: 80 },
  [
    pin('p0', '0', { x: 15, y: 80 }, 'digital'),
    pin('p1', '1', { x: 35, y: 80 }, 'digital'),
    pin('p2', '2', { x: 55, y: 80 }, 'digital'),
    pin('p3v', '3V', { x: 75, y: 80 }, 'power'),
    pin('gnd', 'GND', { x: 95, y: 80 }, 'ground'),
  ]
)

export const attiny85Definition = dipPart('attiny85', 'ATtiny85', 8, [
  'PB5',
  'PB3',
  'PB4',
  'GND',
  'PB0',
  'PB1',
  'PB2',
  'VCC',
])

export const multimeterDefinition: PartDefinition<'multimeter'> = {
  type: 'multimeter',
  label: 'Multimeter',
  category: 'boards',
  size: { width: 92, height: 120 },
  defaultProps: { mode: 'volts' },
  pins: [
    pin('plus', '+', { x: 24, y: 120 }, 'analog'),
    pin('minus', '-', { x: 68, y: 120 }, 'ground'),
  ],
  propFields: [
    {
      kind: 'select',
      key: 'mode',
      label: 'Mode',
      options: ['volts', 'amps', 'ohms'],
    },
  ],
}

export const functionGeneratorDefinition: PartDefinition<'function-generator'> = {
  type: 'function-generator',
  label: 'Function Generator',
  category: 'boards',
  size: { width: 100, height: 80 },
  defaultProps: { waveform: 'sine', frequencyHz: 1_000, amplitudeVolts: 5, offsetVolts: 0 },
  pins: [
    pin('plus', '+', { x: 70, y: 80 }, 'power'),
    pin('minus', '-', { x: 30, y: 80 }, 'ground'),
  ],
  propFields: [
    {
      kind: 'select',
      key: 'waveform',
      label: 'Waveform',
      options: ['sine', 'square', 'triangle'],
    },
    {
      kind: 'number',
      key: 'frequencyHz',
      label: 'Frequency',
      min: 0.1,
      max: 100_000,
      step: 0.1,
      unit: 'Hz',
    },
    {
      kind: 'number',
      key: 'amplitudeVolts',
      label: 'Amplitude',
      min: 0,
      max: 12,
      step: 0.1,
      unit: 'V',
    },
    {
      kind: 'number',
      key: 'offsetVolts',
      label: 'DC offset',
      min: -12,
      max: 12,
      step: 0.1,
      unit: 'V',
    },
  ],
}

export const oscilloscopeDefinition = genericPart(
  'oscilloscope',
  'Oscilloscope',
  'boards',
  { width: 130, height: 88 },
  [pin('plus', 'CH1', { x: 30, y: 88 }, 'analog'), pin('gnd', 'GND', { x: 100, y: 88 }, 'ground')]
)

export const ic555Definition = dipPart('ic-555', '555 Timer', 8, [
  'GND',
  'TRIG',
  'OUT',
  'RESET',
  'CTRL',
  'THRES',
  'DISCH',
  'VCC',
])
export const ic556Definition = dipPart('ic-556', '556 Dual Timer', 14)
export const opamp741Definition = dipPart('opamp-741', '741 Op-Amp', 8, [
  'OFFSET',
  'IN-',
  'IN+',
  'V-',
  'OFFSET',
  'OUT',
  'V+',
  'NC',
])
export const comparatorLm393Definition = dipPart('comparator-lm393', 'LM393 Comparator', 8, [
  'OUT1',
  'IN1-',
  'IN1+',
  'GND',
  'IN2+',
  'IN2-',
  'OUT2',
  'VCC',
])
export const comparatorLm339Definition = dipPart('comparator-lm339', 'LM339 Comparator', 14)
export const optocoupler4n35Definition = dipPart('optocoupler-4n35', 'Optocoupler 4N35', 6, [
  'ANODE',
  'CATHODE',
  'NC',
  'EMITTER',
  'COLLECTOR',
  'BASE',
])
export const transistorNpnDefinition = genericPart(
  'transistor-npn',
  'NPN Transistor',
  'passives',
  { width: 56, height: 56 },
  [
    pin('base', 'B', { x: 0, y: 28 }, 'digital'),
    pin('collector', 'C', { x: 40, y: 0 }, 'passive'),
    pin('emitter', 'E', { x: 40, y: 56 }, 'passive'),
  ]
)
export const transistorPnpDefinition = genericPart(
  'transistor-pnp',
  'PNP Transistor',
  'passives',
  { width: 56, height: 56 },
  [
    pin('base', 'B', { x: 0, y: 28 }, 'digital'),
    pin('collector', 'C', { x: 40, y: 0 }, 'passive'),
    pin('emitter', 'E', { x: 40, y: 56 }, 'passive'),
  ]
)
export const tip120Definition = genericPart(
  'tip120',
  'TIP120 Darlington',
  'passives',
  { width: 64, height: 64 },
  [
    pin('base', 'B', { x: 0, y: 32 }, 'digital'),
    pin('collector', 'C', { x: 46, y: 0 }, 'passive'),
    pin('emitter', 'E', { x: 46, y: 64 }, 'passive'),
  ]
)
export const mosfetNDefinition = genericPart(
  'mosfet-n',
  'N-MOSFET',
  'passives',
  { width: 60, height: 60 },
  [
    pin('gate', 'G', { x: 0, y: 30 }, 'digital'),
    pin('drain', 'D', { x: 44, y: 0 }, 'passive'),
    pin('source', 'S', { x: 44, y: 60 }, 'passive'),
  ]
)
export const mosfetPDefinition = genericPart(
  'mosfet-p',
  'P-MOSFET',
  'passives',
  { width: 60, height: 60 },
  [
    pin('gate', 'G', { x: 0, y: 30 }, 'digital'),
    pin('drain', 'D', { x: 44, y: 0 }, 'passive'),
    pin('source', 'S', { x: 44, y: 60 }, 'passive'),
  ]
)
export const relaySpdtDefinition = genericPart(
  'relay-spdt',
  'Relay SPDT',
  'outputs',
  { width: 120, height: 72 },
  [
    pin('coil1', 'COIL1', { x: 16, y: 0 }, 'passive'),
    pin('coil2', 'COIL2', { x: 56, y: 0 }, 'passive'),
    pin('com', 'COM', { x: 96, y: 72 }, 'passive'),
    pin('nc', 'NC', { x: 58, y: 72 }, 'passive'),
    pin('no', 'NO', { x: 120, y: 40 }, 'passive'),
  ]
)
export const relayDpdtDefinition = genericPart(
  'relay-dpdt',
  'Relay DPDT',
  'outputs',
  { width: 140, height: 88 },
  [
    pin('coil1', 'COIL1', { x: 16, y: 0 }, 'passive'),
    pin('coil2', 'COIL2', { x: 60, y: 0 }, 'passive'),
    pin('com1', 'COM1', { x: 56, y: 88 }, 'passive'),
    pin('nc1', 'NC1', { x: 18, y: 88 }, 'passive'),
    pin('no1', 'NO1', { x: 90, y: 88 }, 'passive'),
    pin('com2', 'COM2', { x: 130, y: 88 }, 'passive'),
    pin('nc2', 'NC2', { x: 116, y: 64 }, 'passive'),
    pin('no2', 'NO2', { x: 140, y: 40 }, 'passive'),
  ]
)
export const l293dDefinition = dipPart('l293d', 'L293D H-Bridge', 16, [
  'EN1',
  'IN1',
  'OUT1',
  'GND',
  'GND',
  'OUT2',
  'IN2',
  'VCC2',
  'EN3',
  'IN3',
  'OUT3',
  'GND',
  'GND',
  'OUT4',
  'IN4',
  'VCC1',
])
export const header8Definition = genericPart(
  'header-8',
  '8-Pin Header',
  'boards',
  { width: 100, height: 30 },
  Array.from({ length: 8 }, (_unused, index) =>
    pin(String(index + 1), String(index + 1), { x: 8 + index * 12, y: 30 }, 'passive')
  )
)
export const usbADefinition = genericPart(
  'usb-a',
  'USB Type-A',
  'boards',
  { width: 88, height: 44 },
  [
    pin('vbus', 'VBUS', { x: 14, y: 44 }, 'power'),
    pin('dminus', 'D-', { x: 34, y: 44 }, 'digital'),
    pin('dplus', 'D+', { x: 54, y: 44 }, 'digital'),
    pin('gnd', 'GND', { x: 74, y: 44 }, 'ground'),
  ]
)

function compactBreadboard(columns: number): {
  readonly size: Size
  readonly pins: readonly PartPin[]
  readonly internalNets: readonly (readonly string[])[]
} {
  const pins: PartPin[] = []
  const nets: string[][] = []
  const topRows = ['a', 'b', 'c', 'd', 'e'] as const
  const bottomRows = ['f', 'g', 'h', 'i', 'j'] as const
  const pitch = 12
  const firstX = 24
  const width = firstX + (columns - 1) * pitch + 24
  for (let column = 1; column <= columns; column += 1) {
    const x = firstX + (column - 1) * pitch
    for (const [index, row] of topRows.entries()) {
      pins.push(pin(`${row}${column}`, `${row}${column}`, { x, y: 38 + index * 10 }, 'passive'))
    }
    for (const [index, row] of bottomRows.entries()) {
      pins.push(pin(`${row}${column}`, `${row}${column}`, { x, y: 92 + index * 10 }, 'passive'))
    }
    nets.push(topRows.map((row) => `${row}${column}`))
    nets.push(bottomRows.map((row) => `${row}${column}`))
  }
  for (const [prefix, label, y, kind] of [
    ['top-plus', '+', 12, 'power'],
    ['top-minus', '-', 22, 'ground'],
    ['bottom-plus', '+', 142, 'power'],
    ['bottom-minus', '-', 152, 'ground'],
  ] as const) {
    const rail: string[] = []
    for (let column = 1; column <= columns; column += 1) {
      const id = `${prefix}-${column}`
      pins.push(pin(id, label, { x: firstX + (column - 1) * pitch, y }, kind))
      rail.push(id)
    }
    nets.push(rail)
  }
  return { size: { width, height: 166 }, pins, internalNets: nets }
}

const smallBreadboard = compactBreadboard(12)
const miniBreadboard = compactBreadboard(8)

export const breadboardSmallDefinition = genericPart(
  'breadboard-small',
  'Small Breadboard',
  'boards',
  smallBreadboard.size,
  smallBreadboard.pins,
  { internalNets: smallBreadboard.internalNets }
)
export const breadboardMiniDefinition = genericPart(
  'breadboard-mini',
  'Mini Breadboard',
  'boards',
  miniBreadboard.size,
  miniBreadboard.pins,
  { internalNets: miniBreadboard.internalNets }
)

export const gate74hc00Definition = gatePart(
  '74hc00',
  '74HC00 NAND',
  14,
  QUAD_2_INPUT,
  GATE_14_LABELS
)
export const gate74hc02Definition = gatePart(
  '74hc02',
  '74HC02 NOR',
  14,
  QUAD_2_INPUT,
  GATE_14_LABELS
)
export const gate74hc08Definition = gatePart(
  '74hc08',
  '74HC08 AND',
  14,
  QUAD_2_INPUT,
  GATE_14_LABELS
)
export const gate74hc32Definition = gatePart(
  '74hc32',
  '74HC32 OR',
  14,
  QUAD_2_INPUT,
  GATE_14_LABELS
)
export const gate74hc86Definition = gatePart(
  '74hc86',
  '74HC86 XOR',
  14,
  QUAD_2_INPUT,
  GATE_14_LABELS
)
export const gate74hc04Definition = gatePart(
  '74hc04',
  '74HC04 Inverter',
  14,
  HEX_INVERTER,
  GATE_14_SINGLE_LABELS
)
export const gate74hc14Definition = gatePart(
  '74hc14',
  '74HC14 Schmitt Inverter',
  14,
  HEX_INVERTER,
  GATE_14_SINGLE_LABELS
)
export const gate74hc131Definition = gatePart(
  '74hc131',
  '74HC131 NAND Schmitt',
  14,
  QUAD_2_INPUT,
  GATE_14_LABELS
)
export const gate74hc132Definition = gatePart(
  '74hc132',
  '74HC132 NAND Schmitt',
  14,
  QUAD_2_INPUT,
  GATE_14_LABELS
)
export const gate74hc10Definition = gatePart(
  '74hc10',
  '74HC10 Triple NAND',
  14,
  TRIPLE_3_INPUT,
  GATE_TRIPLE_LABELS
)
export const gate74hc11Definition = gatePart(
  '74hc11',
  '74HC11 Triple AND',
  14,
  TRIPLE_3_INPUT,
  GATE_TRIPLE_LABELS
)
export const gate74hc27Definition = gatePart(
  '74hc27',
  '74HC27 Triple NOR',
  14,
  TRIPLE_3_INPUT,
  GATE_TRIPLE_LABELS
)
export const gate74hc20Definition = gatePart(
  '74hc20',
  '74HC20 Dual 4-Input NAND',
  14,
  DUAL_4_INPUT,
  GATE_DUAL_4_LABELS
)
export const gate74hc21Definition = gatePart(
  '74hc21',
  '74HC21 Dual 4-Input AND',
  14,
  DUAL_4_INPUT,
  GATE_DUAL_4_LABELS
)

export const ic74hc73Definition = dipPart('74hc73', '74HC73 Dual J-K Flip-Flop', 14)
export const ic74hc74Definition = dipPart('74hc74', '74HC74 Dual D Flip-Flop', 14)
export const ic74hc75Definition = dipPart('74hc75', '74HC75 4-Bit Latch', 16)
export const ic74hc93Definition = dipPart('74hc93', '74HC93 4-Bit Counter', 14)
export const ic74hc283Definition = dipPart('74hc283', '74HC283 4-Bit Adder', 16)
export const ic74hc595Definition = dipPart('74hc595', '74HC595 Shift Register', 16)
export const ic74hc4017Definition = dipPart('74hc4017', '74HC4017 Decade Counter', 16)
export const cd4511Definition = dipPart('cd4511', 'CD4511 BCD Decoder', 16)

export type GateOperation = 'nand' | 'nor' | 'and' | 'or' | 'xor' | 'not'

export interface GateSpec {
  readonly inputs: readonly string[]
  readonly output: string
  readonly op: GateOperation
}

function gateSpecs(gates: readonly (readonly number[])[], op: GateOperation): readonly GateSpec[] {
  return gates.map((gate) => ({
    inputs: gate.slice(0, -1).map(String),
    output: String(gate[gate.length - 1]),
    op,
  }))
}

export const GATE_TOPOLOGY: Partial<Record<PartType, readonly GateSpec[]>> = {
  '74hc00': gateSpecs(QUAD_2_INPUT, 'nand'),
  '74hc02': gateSpecs(QUAD_2_INPUT, 'nor'),
  '74hc08': gateSpecs(QUAD_2_INPUT, 'and'),
  '74hc32': gateSpecs(QUAD_2_INPUT, 'or'),
  '74hc86': gateSpecs(QUAD_2_INPUT, 'xor'),
  '74hc04': gateSpecs(HEX_INVERTER, 'not'),
  '74hc14': gateSpecs(HEX_INVERTER, 'not'),
  '74hc131': gateSpecs(QUAD_2_INPUT, 'nand'),
  '74hc132': gateSpecs(QUAD_2_INPUT, 'nand'),
  '74hc10': gateSpecs(TRIPLE_3_INPUT, 'nand'),
  '74hc11': gateSpecs(TRIPLE_3_INPUT, 'and'),
  '74hc27': gateSpecs(TRIPLE_3_INPUT, 'nor'),
  '74hc20': gateSpecs(DUAL_4_INPUT, 'nand'),
  '74hc21': gateSpecs(DUAL_4_INPUT, 'and'),
}

const additionalDefinitions = [
  irReceiverDefinition,
  ultrasonic3PinDefinition,
  ultrasonicHcsr04Definition,
  pirSensorDefinition,
  keypad4x4Definition,
  neopixelStripDefinition,
  neopixelRingDefinition,
  irRemoteDefinition,
  encoderMotorDefinition,
  servoDefinition,
  lcd16x2Definition,
  lcd16x2I2cDefinition,
  sevenSegmentClockDefinition,
  microbitDefinition,
  attiny85Definition,
  multimeterDefinition,
  functionGeneratorDefinition,
  oscilloscopeDefinition,
  ic555Definition,
  ic556Definition,
  opamp741Definition,
  comparatorLm393Definition,
  comparatorLm339Definition,
  optocoupler4n35Definition,
  transistorNpnDefinition,
  transistorPnpDefinition,
  tip120Definition,
  mosfetNDefinition,
  mosfetPDefinition,
  relaySpdtDefinition,
  relayDpdtDefinition,
  l293dDefinition,
  header8Definition,
  usbADefinition,
  breadboardSmallDefinition,
  breadboardMiniDefinition,
  gate74hc00Definition,
  gate74hc02Definition,
  gate74hc08Definition,
  gate74hc32Definition,
  gate74hc86Definition,
  gate74hc04Definition,
  gate74hc14Definition,
  gate74hc131Definition,
  gate74hc132Definition,
  gate74hc10Definition,
  gate74hc11Definition,
  gate74hc27Definition,
  gate74hc20Definition,
  gate74hc21Definition,
  ic74hc73Definition,
  ic74hc74Definition,
  ic74hc75Definition,
  ic74hc93Definition,
  ic74hc283Definition,
  ic74hc595Definition,
  ic74hc4017Definition,
  cd4511Definition,
] as const

export const partDefinitions = [
  arduinoUnoDefinition,
  raspberryPiDefinition,
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
  electrolyticCapacitorDefinition,
  zenerDiodeDefinition,
  lightBulbDefinition,
  vibrationMotorDefinition,
  gearMotorDefinition,
  thermistorDefinition,
  flexSensorDefinition,
  forceSensorDefinition,
  photodiodeDefinition,
  phototransistorDefinition,
  tiltSensorDefinition,
  soilMoistureDefinition,
  gasSensorDefinition,
  tmp36Definition,
  coinCellDefinition,
  solarCellDefinition,
  potatoBatteryDefinition,
  dipSwitch4Definition,
  dipSwitch6Definition,
  lm7805Definition,
  ld1117v33Definition,
  ...additionalDefinitions,
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

/** Pin offset from the part's top-left after mirroring, before rotation. */
export function localPinPosition(part: PartInstance, pinId: string): Point {
  const definition = definitionOf(part.type)
  const local = pinOf(part.type, pinId)
  return {
    x: part.flipX === true ? definition.size.width - local.position.x : local.position.x,
    y: part.flipY === true ? definition.size.height - local.position.y : local.position.y,
  }
}

/** The pin definition with its mirrored position, for edge and label layout. */
export function effectivePin(part: PartInstance, pin: PartPin): PartPin {
  return { ...pin, position: localPinPosition(part, pin.id) }
}

/** Absolute world position of a pin, accounting for flipping and rotation. */
export function pinWorldPosition(part: PartInstance, pinId: string): Point {
  const definition = definitionOf(part.type)
  const local = localPinPosition(part, pinId)
  const rotated = rotateOffset(local, part.rotation, definition.size)
  return { x: part.position.x + rotated.x, y: part.position.y + rotated.y }
}
