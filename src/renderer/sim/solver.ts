import type { CircuitDocument, LedColor, PartType } from '../../shared/circuit'
import { pinKey } from '../../shared/circuit'
import type { Netlist } from '../wiring/netlist'
import { GATE_TOPOLOGY } from '../parts/definitions'

/**
 * A tiny piecewise-linear circuit solver. It is not SPICE: LEDs are a forward
 * voltage plus a small series resistance, switches are either closed or open,
 * and the Arduino pins are Thevenin sources. That is enough to light LEDs the
 * way a real board would and cheap enough to re-solve whenever a pin toggles.
 */

export interface PinDriver {
  readonly volts: number
  readonly resistanceOhms: number
  /**
   * PWM duty cycle, 0 to 1. The driver voltage is the high level; branch
   * currents are computed there and scaled by duty so a diode keeps its
   * forward voltage instead of seeing an average voltage below its knee.
   */
  readonly duty?: number
}

/** Pin key (`partId:pinId`) to the source pushing that net around. */
export type DriverMap = ReadonlyMap<string, PinDriver>

export interface SolveOptions {
  /** Parts whose push button is held down. */
  readonly pressedParts?: ReadonlySet<string>
  /** Potentiometer wiper position, 0 to 1. */
  readonly potPositions?: ReadonlyMap<string, number>
  /** Latched on/off state for slide switches. */
  readonly switchStates?: ReadonlyMap<string, boolean>
  /** Photosensor and other analog sensor levels, normalised 0 to 1. */
  readonly sensorLevels?: ReadonlyMap<string, number>
  /** Per-bit state for DIP switch banks, index 0 is the first switch. */
  readonly dipBits?: ReadonlyMap<string, readonly boolean[]>
  /** Pressed matrix-keypad key index, row-major from 0 to 15. */
  readonly keypadKeys?: ReadonlyMap<string, number>
}

export interface SolveResult {
  /** Amps through each LED, keyed by part id. */
  readonly ledCurrents: ReadonlyMap<string, number>
  /** Amps through each buzzer, keyed by part id. */
  readonly buzzerCurrents: ReadonlyMap<string, number>
  /** Amps through each DC motor, keyed by part id. */
  readonly motorCurrents: ReadonlyMap<string, number>
  /** Volts at each net, keyed by netlist net id. */
  readonly netVoltages: ReadonlyMap<number, number>
}

export const LED_FORWARD_VOLTAGE: Readonly<Record<LedColor, number>> = {
  red: 1.8,
  green: 2.1,
  blue: 3,
  yellow: 2,
  white: 3,
}

/** The forward voltage never has a truly vertical knee; this keeps the matrix sane. */
const LED_SERIES_RESISTANCE_OHMS = 0.5
/** Leak from every node to the reference, so floating nets have a defined 0 V. */
const NODE_LEAK_CONDUCTANCE = 1e-9
const OPEN_RESISTANCE_OHMS = 1e9
const BUZZER_RESISTANCE_OHMS = 100
const DIODE_FORWARD_VOLTS = 0.65
const DIODE_SERIES_RESISTANCE_OHMS = 1.5
const INDUCTOR_RESISTANCE_OHMS = 0.05
const MOTOR_RESISTANCE_OHMS = 20
const VIBRATION_MOTOR_RESISTANCE_OHMS = 30
const GEAR_MOTOR_RESISTANCE_OHMS = 60
const GAS_HEATER_RESISTANCE_OHMS = 30
const NEOPIXEL_LOAD_RESISTANCE_OHMS = 50
const LCD_LOAD_RESISTANCE_OHMS = 220
const SERVO_LOAD_RESISTANCE_OHMS = 100
const RELAY_COIL_RESISTANCE_OHMS = 200
const METER_RESISTANCE_OHMS = 10_000_000
const SCOPE_RESISTANCE_OHMS = 1_000_000
const MODULE_OUTPUT_RESISTANCE_OHMS = 1_000
/** Closed mechanical contacts; low enough to behave like a wire. */
const CLOSED_SWITCH_RESISTANCE_OHMS = 0.5

function sensorResistance(type: PartType, rawLevel: number): number {
  const level = Math.min(1, Math.max(0, rawLevel))
  switch (type) {
    case 'thermistor':
      return 10_000 * Math.pow(10, (0.5 - level) * 2)
    case 'flex-sensor':
      return 10_000 + 20_000 * level
    case 'force-sensor':
      return 1_000 + 999_000 * (1 - level)
    case 'photodiode':
      return 10_000 + 990_000 * (1 - level)
    case 'phototransistor':
      return 1_000 + 999_000 * (1 - level)
    case 'soil-moisture':
      return 1_000 * Math.pow(1_000, 1 - level)
    case 'gas-sensor':
      return 1_000 * Math.pow(100, 1 - level)
    case 'ldr':
      return 1_000 * Math.pow(1_000, 1 - level)
    default:
      return 1_000_000
  }
}

function sourceVoltage(type: PartType, level: number): number | null {
  switch (type) {
    case 'coin-cell':
      return 3
    case 'potato-battery':
      return 0.9
    case 'solar-cell':
      return 0.6 * level
    case 'lm7805':
      return 5
    case 'ld1117v33':
      return 3.3
    case 'tmp36': {
      const temperature = -40 + level * 165
      return 0.5 + temperature * 0.01
    }
    case 'soil-moisture':
    case 'ultrasonic-3pin':
    case 'ultrasonic-hcsr04':
      return 5 * level
    case 'pir-sensor':
      return level > 0.5 ? 5 : 0
    default:
      return null
  }
}

function sourceResistance(type: PartType): number {
  switch (type) {
    case 'coin-cell':
      return 20
    case 'potato-battery':
      return 1_000
    case 'solar-cell':
      return 10
    case 'lm7805':
    case 'ld1117v33':
      return 0.2
    case 'tmp36':
      return 10
    case 'soil-moisture':
      return 1_000
    default:
      return 1
  }
}

/**
 * Modified nodal analysis over netlist nets. Index 0 is the reference node;
 * every other net and every internal source node gets a row.
 */
class Mna {
  private readonly rows: number[][] = []
  private readonly rhs: number[] = []
  private readonly netIndices = new Map<number, number>()
  private readonly groundNets = new Set<number>()
  private readonly netNodes = new Set<number>()
  private nextIndex = 1

  constructor(private readonly capacity: number) {}

  setGround(netId: number): void {
    this.groundNets.add(netId)
  }

  /** Ground nets collapse to the reference node, so parallel grounds are never singular. */
  indexOfNet(netId: number | undefined): number {
    if (netId === undefined || this.groundNets.has(netId)) return 0
    const existing = this.netIndices.get(netId)
    if (existing !== undefined) return existing
    const index = this.allocate()
    this.netIndices.set(netId, index)
    this.netNodes.add(index)
    return index
  }

  newNode(): number {
    return this.allocate()
  }

  private allocate(): number {
    if (this.nextIndex >= this.capacity) {
      throw new Error('circuit matrix exceeded its capacity')
    }
    const index = this.nextIndex
    this.nextIndex += 1
    return index
  }

  private ensureRow(index: number): void {
    while (this.rows.length <= index) {
      this.rows.push(new Array<number>(this.capacity).fill(0))
      this.rhs.push(0)
    }
  }

  addConductance(a: number, b: number, conductance: number): void {
    if (a === b) return
    this.ensureRow(Math.max(a, b))
    if (a !== 0) this.rows[a]![a]! += conductance
    if (b !== 0) this.rows[b]![b]! += conductance
    if (a !== 0 && b !== 0) {
      this.rows[a]![b]! -= conductance
      this.rows[b]![a]! -= conductance
    }
  }

  /** Ideal source with + at `positive` relative to `negative`. */
  addVoltageSource(positive: number, negative: number, volts: number): void {
    const branch = this.allocate()
    this.ensureRow(branch)
    if (positive !== 0) {
      this.rows[positive]![branch]! += 1
      this.rows[branch]![positive]! += 1
    }
    if (negative !== 0) {
      this.rows[negative]![branch]! -= 1
      this.rows[branch]![negative]! -= 1
    }
    this.rhs[branch] = volts
  }

  solve(): { volts: Float64Array; netIndices: ReadonlyMap<number, number> } | null {
    // Floating sub-circuits still need a finite solution; a leak to ground is
    // the standard trick and is far below any current a real part would draw.
    for (const node of this.netNodes) {
      this.addConductance(node, 0, NODE_LEAK_CONDUCTANCE)
    }

    const netIndices = new Map(this.netIndices)
    // Index 0 is the reference node, so the unknowns are matrix rows 1..n.
    const variables = this.nextIndex - 1
    if (variables <= 0) return { volts: new Float64Array(1), netIndices }
    this.ensureRow(this.nextIndex - 1)

    const size = variables
    const matrix = new Float64Array(size * (size + 1))
    for (let row = 0; row < size; row += 1) {
      for (let column = 0; column < size; column += 1) {
        matrix[row * (size + 1) + column] = this.rows[row + 1]?.[column + 1] ?? 0
      }
      matrix[row * (size + 1) + size] = this.rhs[row + 1] ?? 0
    }

    for (let column = 0; column < size; column += 1) {
      let pivot = column
      let best = Math.abs(matrix[column * (size + 1) + column] ?? 0)
      for (let row = column + 1; row < size; row += 1) {
        const value = Math.abs(matrix[row * (size + 1) + column] ?? 0)
        if (value > best) {
          best = value
          pivot = row
        }
      }
      if (best < 1e-12) return null

      if (pivot !== column) {
        for (let k = column; k <= size; k += 1) {
          const a = matrix[column * (size + 1) + k] ?? 0
          const b = matrix[pivot * (size + 1) + k] ?? 0
          matrix[column * (size + 1) + k] = b
          matrix[pivot * (size + 1) + k] = a
        }
      }

      const diagonal = matrix[column * (size + 1) + column] ?? 1
      for (let row = column + 1; row < size; row += 1) {
        const factor = (matrix[row * (size + 1) + column] ?? 0) / diagonal
        if (factor === 0) continue
        for (let k = column; k <= size; k += 1) {
          matrix[row * (size + 1) + k] =
            (matrix[row * (size + 1) + k] ?? 0) - factor * (matrix[column * (size + 1) + k] ?? 0)
        }
      }
    }

    const volts = new Float64Array(this.nextIndex)
    for (let row = size - 1; row >= 0; row -= 1) {
      let sum = matrix[row * (size + 1) + size] ?? 0
      for (let column = row + 1; column < size; column += 1) {
        sum -= (matrix[row * (size + 1) + column] ?? 0) * (volts[column + 1] ?? 0)
      }
      const diagonal = matrix[row * (size + 1) + row] ?? 1
      volts[row + 1] = sum / diagonal
    }

    const solution = volts
    return { volts: solution, netIndices }
  }
}

interface DiodeBranch {
  readonly partId: string
  /** Key used in the result map: the part id, or `partId:channel` for multi-die parts. */
  readonly key: string
  readonly anodeNet: number
  readonly cathodeNet: number
  readonly forwardVolts: number
  readonly seriesOhms: number
  readonly emitsLight: boolean
  on: boolean
}

/** Common forward voltage used by multi-die parts. */
function forwardVoltsFor(color: LedColor): number {
  return LED_FORWARD_VOLTAGE[color]
}

/**
 * The Uno's 0 V pins are the reference. Without collapsing them, wiring both
 * ground pins to the same breadboard rail would create a loop of ideal sources.
 */
function findGroundNets(
  document: CircuitDocument,
  netlist: Netlist,
  drivers: DriverMap
): Set<number> {
  const ground = new Set<number>()
  for (const part of document.parts) {
    if (part.type !== 'arduino-uno') continue
    for (const pinId of ['GND', 'GND2']) {
      const driver = drivers.get(pinKey({ partId: part.id, pinId }))
      if (driver === undefined || driver.volts !== 0) continue
      const net = netlist.netIdOf({ partId: part.id, pinId })
      if (net !== undefined) ground.add(net)
    }
  }
  return ground
}

export function solveCircuit(
  document: CircuitDocument,
  netlist: Netlist,
  drivers: DriverMap,
  options: SolveOptions = {}
): SolveResult {
  const pressed = options.pressedParts ?? new Set<string>()
  const pots = options.potPositions ?? new Map<string, number>()
  const switches = options.switchStates ?? new Map<string, boolean>()
  const sensors = options.sensorLevels ?? new Map<string, number>()
  const dipBits = options.dipBits ?? new Map<string, readonly boolean[]>()
  const keypadKeys = options.keypadKeys ?? new Map<string, number>()
  const gateStates = new Map<string, boolean[]>()
  const relayStates = new Map<string, boolean>()
  const transistorStates = new Map<string, boolean>()
  const groundNets = findGroundNets(document, netlist, drivers)

  const netOf = (partId: string, pinId: string): number | undefined =>
    netlist.netIdOf({ partId, pinId })

  const dutyByNet = new Map<number, number>()
  const fixedNets = new Set<number>()
  for (const [key, driver] of drivers) {
    const separator = key.lastIndexOf(':')
    const net = netOf(key.slice(0, separator), key.slice(separator + 1))
    if (net === undefined) continue
    if (driver.duty === undefined) {
      fixedNets.add(net)
      continue
    }
    const duty = Math.min(1, Math.max(0, driver.duty))
    dutyByNet.set(net, Math.max(dutyByNet.get(net) ?? 0, duty))
  }

  // A PWM pin is nearly always separated from an LED by a series resistor, so
  // the duty has to travel through passive parts to reach the diode branch.
  // Fixed rails stop the flood: the average at a 5V/GND net is not the pin's
  // duty, and a static source would dominate a PWM one anyway.
  const links: [number, number][] = []
  const link = (a: number | undefined, b: number | undefined): void => {
    if (a !== undefined && b !== undefined && a !== b) links.push([a, b])
  }
  for (const part of document.parts) {
    switch (part.type) {
      case 'resistor':
        link(netOf(part.id, 'lead1'), netOf(part.id, 'lead2'))
        break
      case 'inductor':
        link(netOf(part.id, '1'), netOf(part.id, '2'))
        break
      case 'light-bulb':
        link(netOf(part.id, '1'), netOf(part.id, '2'))
        break
      case 'thermistor':
      case 'flex-sensor':
      case 'force-sensor':
        link(netOf(part.id, '1'), netOf(part.id, '2'))
        break
      case 'photodiode':
        link(netOf(part.id, 'anode'), netOf(part.id, 'cathode'))
        break
      case 'phototransistor':
        link(netOf(part.id, 'collector'), netOf(part.id, 'emitter'))
        break
      case 'gas-sensor':
        link(netOf(part.id, 'a1'), netOf(part.id, 'b1'))
        break
      case 'ldr':
        link(netOf(part.id, '1'), netOf(part.id, '2'))
        break
      case 'tilt-sensor':
        if ((sensors.get(part.id) ?? 0.5) > 0.5) link(netOf(part.id, '1'), netOf(part.id, '2'))
        break
      case 'dip-switch-4':
      case 'dip-switch-6': {
        const bits = dipBits.get(part.id) ?? []
        for (let bit = 0; bit < bits.length; bit += 1) {
          if (bits[bit] === true) {
            link(netOf(part.id, `top${bit + 1}`), netOf(part.id, `bottom${bit + 1}`))
          }
        }
        break
      }
      case 'potentiometer':
        link(netOf(part.id, '1'), netOf(part.id, '2'))
        link(netOf(part.id, '2'), netOf(part.id, '3'))
        break
      case 'keypad-4x4': {
        const key = keypadKeys.get(part.id)
        if (key !== undefined) {
          link(netOf(part.id, `r${Math.floor(key / 4) + 1}`), netOf(part.id, `c${(key % 4) + 1}`))
        }
        break
      }
      case 'push-button':
        if (pressed.has(part.id)) link(netOf(part.id, '1'), netOf(part.id, '2'))
        break
      case 'slide-switch':
        if (switches.get(part.id) === true) link(netOf(part.id, '1'), netOf(part.id, '2'))
        break
      default:
        break
    }
  }

  let spread = true
  while (spread) {
    spread = false
    for (const [a, b] of links) {
      const aDuty = dutyByNet.get(a)
      const bDuty = dutyByNet.get(b)
      if (aDuty !== undefined && !fixedNets.has(b) && aDuty > (bDuty ?? -1)) {
        dutyByNet.set(b, aDuty)
        spread = true
      }
      if (bDuty !== undefined && !fixedNets.has(a) && bDuty > (aDuty ?? -1)) {
        dutyByNet.set(a, bDuty)
        spread = true
      }
    }
  }

  /**
   * Time-weighted average of a branch driven by one or two PWM pins. With a
   * steady anode and a PWM cathode (common-anode wiring) the factor becomes
   * 1 - duty; with PWM on both sides it is the duty difference.
   */
  const pwmFactor = (anodeNet: number, cathodeNet: number): number => {
    const anodeDuty = dutyByNet.get(anodeNet)
    const cathodeDuty = dutyByNet.get(cathodeNet)
    if (anodeDuty === undefined && cathodeDuty === undefined) return 1
    if (anodeDuty !== undefined && cathodeDuty !== undefined) {
      return Math.min(1, Math.max(0, anodeDuty - cathodeDuty))
    }
    if (anodeDuty !== undefined) return anodeDuty
    return Math.min(1, Math.max(0, 1 - (cathodeDuty ?? 0)))
  }

  const diodeBranches: DiodeBranch[] = []
  const addBranch = (branch: DiodeBranch): void => {
    diodeBranches.push(branch)
  }

  for (const part of document.parts) {
    switch (part.type) {
      case 'led': {
        const anodeNet = netOf(part.id, 'anode')
        const cathodeNet = netOf(part.id, 'cathode')
        if (anodeNet === undefined || cathodeNet === undefined) break
        addBranch({
          partId: part.id,
          key: part.id,
          anodeNet,
          cathodeNet,
          forwardVolts: LED_FORWARD_VOLTAGE[part.props.color],
          seriesOhms: LED_SERIES_RESISTANCE_OHMS,
          emitsLight: true,
          on: false,
        })
        break
      }
      case 'diode':
      case 'zener-diode': {
        const anodeNet = netOf(part.id, 'anode')
        const cathodeNet = netOf(part.id, 'cathode')
        if (anodeNet === undefined || cathodeNet === undefined) break
        addBranch({
          partId: part.id,
          key: part.id,
          anodeNet,
          cathodeNet,
          forwardVolts: DIODE_FORWARD_VOLTS,
          seriesOhms: DIODE_SERIES_RESISTANCE_OHMS,
          emitsLight: false,
          on: false,
        })
        if (part.type === 'zener-diode') {
          addBranch({
            partId: part.id,
            key: `${part.id}:zener`,
            anodeNet: cathodeNet,
            cathodeNet: anodeNet,
            forwardVolts: part.props.zenerVoltage,
            seriesOhms: DIODE_SERIES_RESISTANCE_OHMS,
            emitsLight: false,
            on: false,
          })
        }
        break
      }
      case 'rgb-led': {
        const cathodeNet = netOf(part.id, 'cathode')
        if (cathodeNet === undefined) break
        for (const channel of ['red', 'green', 'blue'] as const) {
          const anodeNet = netOf(part.id, channel)
          if (anodeNet === undefined) continue
          addBranch({
            partId: part.id,
            key: `${part.id}:${channel}`,
            anodeNet,
            cathodeNet,
            forwardVolts: forwardVoltsFor(channel),
            seriesOhms: LED_SERIES_RESISTANCE_OHMS,
            emitsLight: true,
            on: false,
          })
        }
        break
      }
      case 'seven-segment': {
        const cathodeNet = netOf(part.id, 'common')
        if (cathodeNet === undefined) break
        for (const segment of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'] as const) {
          const anodeNet = netOf(part.id, segment)
          if (anodeNet === undefined) continue
          addBranch({
            partId: part.id,
            key: `${part.id}:${segment}`,
            anodeNet,
            cathodeNet,
            forwardVolts: forwardVoltsFor(part.props.color),
            seriesOhms: LED_SERIES_RESISTANCE_OHMS,
            emitsLight: true,
            on: false,
          })
        }
        break
      }
      default:
        break
    }
  }

  const capacity = netlist.netCount + drivers.size * 3 + diodeBranches.length * 4 + 24

  const build = (): Mna => {
    const mna = new Mna(capacity)
    for (const net of groundNets) mna.setGround(net)

    for (const [key, driver] of drivers) {
      const separator = key.lastIndexOf(':')
      const net = netOf(key.slice(0, separator), key.slice(separator + 1))
      if (net === undefined) continue
      const node = mna.indexOfNet(net)
      const hidden = mna.newNode()
      mna.addVoltageSource(hidden, 0, driver.volts)
      mna.addConductance(hidden, node, 1 / Math.max(driver.resistanceOhms, 0.001))
    }

    for (const part of document.parts) {
      const gates = GATE_TOPOLOGY[part.type]
      if (gates !== undefined) {
        const ground = mna.indexOfNet(netOf(part.id, '7'))
        const states = gateStates.get(part.id) ?? gates.map(() => false)
        for (const [index, gate] of gates.entries()) {
          const output = mna.indexOfNet(netOf(part.id, gate.output))
          const hidden = mna.newNode()
          mna.addVoltageSource(hidden, ground, states[index] === true ? 5 : 0)
          mna.addConductance(hidden, output, 1 / 100)
        }
        continue
      }
      switch (part.type) {
        case 'resistor': {
          const a = mna.indexOfNet(netOf(part.id, 'lead1'))
          const b = mna.indexOfNet(netOf(part.id, 'lead2'))
          mna.addConductance(a, b, 1 / part.props.resistanceOhms)
          break
        }
        case 'push-button': {
          const a = mna.indexOfNet(netOf(part.id, '1'))
          const b = mna.indexOfNet(netOf(part.id, '2'))
          mna.addConductance(a, b, pressed.has(part.id) ? 1 / 0.5 : 1 / OPEN_RESISTANCE_OHMS)
          break
        }
        case 'capacitor':
        case 'electrolytic-capacitor':
          // DC model: a capacitor blocks steady current, so it is an open circuit.
          break
        case 'inductor': {
          const a = mna.indexOfNet(netOf(part.id, '1'))
          const b = mna.indexOfNet(netOf(part.id, '2'))
          mna.addConductance(a, b, 1 / INDUCTOR_RESISTANCE_OHMS)
          break
        }
        case 'diode':
        case 'zener-diode': {
          // The branch table below handles conduction; nothing to add here.
          break
        }
        case 'light-bulb': {
          const a = mna.indexOfNet(netOf(part.id, '1'))
          const b = mna.indexOfNet(netOf(part.id, '2'))
          mna.addConductance(a, b, 1 / part.props.resistanceOhms)
          break
        }
        case 'thermistor':
        case 'flex-sensor':
        case 'force-sensor':
        case 'photodiode':
        case 'phototransistor':
        case 'ldr': {
          const terminals =
            part.type === 'photodiode'
              ? ['anode', 'cathode']
              : part.type === 'phototransistor'
                ? ['collector', 'emitter']
                : ['1', '2']
          const a = mna.indexOfNet(netOf(part.id, terminals[0] ?? ''))
          const b = mna.indexOfNet(netOf(part.id, terminals[1] ?? ''))
          mna.addConductance(a, b, 1 / sensorResistance(part.type, sensors.get(part.id) ?? 0.5))
          break
        }
        case 'tilt-sensor': {
          const a = mna.indexOfNet(netOf(part.id, '1'))
          const b = mna.indexOfNet(netOf(part.id, '2'))
          const closed = (sensors.get(part.id) ?? 0.5) > 0.5
          mna.addConductance(
            a,
            b,
            1 / (closed ? CLOSED_SWITCH_RESISTANCE_OHMS : OPEN_RESISTANCE_OHMS)
          )
          break
        }
        case 'dip-switch-4':
        case 'dip-switch-6': {
          const bits = dipBits.get(part.id) ?? []
          for (let bit = 0; bit < bits.length; bit += 1) {
            const a = mna.indexOfNet(netOf(part.id, `top${bit + 1}`))
            const b = mna.indexOfNet(netOf(part.id, `bottom${bit + 1}`))
            const closed = bits[bit] === true
            mna.addConductance(
              a,
              b,
              1 / (closed ? CLOSED_SWITCH_RESISTANCE_OHMS : OPEN_RESISTANCE_OHMS)
            )
          }
          break
        }
        case 'keypad-4x4': {
          const key = keypadKeys.get(part.id)
          if (key === undefined) break
          const row = mna.indexOfNet(netOf(part.id, `r${Math.floor(key / 4) + 1}`))
          const column = mna.indexOfNet(netOf(part.id, `c${(key % 4) + 1}`))
          mna.addConductance(row, column, 1 / CLOSED_SWITCH_RESISTANCE_OHMS)
          break
        }
        case 'gas-sensor': {
          const heaterA = mna.indexOfNet(netOf(part.id, 'h1'))
          const heaterB = mna.indexOfNet(netOf(part.id, 'h2'))
          mna.addConductance(heaterA, heaterB, 1 / GAS_HEATER_RESISTANCE_OHMS)
          const a = mna.indexOfNet(netOf(part.id, 'a1'))
          const b = mna.indexOfNet(netOf(part.id, 'b1'))
          mna.addConductance(a, b, 1 / sensorResistance(part.type, sensors.get(part.id) ?? 0.5))
          break
        }
        case 'slide-switch': {
          const a = mna.indexOfNet(netOf(part.id, '1'))
          const b = mna.indexOfNet(netOf(part.id, '2'))
          const closed = switches.get(part.id) === true
          mna.addConductance(
            a,
            b,
            1 / (closed ? CLOSED_SWITCH_RESISTANCE_OHMS : OPEN_RESISTANCE_OHMS)
          )
          break
        }
        case 'dc-motor':
        case 'vibration-motor':
        case 'gear-motor': {
          const plus = mna.indexOfNet(netOf(part.id, 'plus'))
          const minus = mna.indexOfNet(netOf(part.id, 'minus'))
          const resistance =
            part.type === 'vibration-motor'
              ? VIBRATION_MOTOR_RESISTANCE_OHMS
              : part.type === 'gear-motor'
                ? GEAR_MOTOR_RESISTANCE_OHMS
                : MOTOR_RESISTANCE_OHMS
          mna.addConductance(plus, minus, 1 / resistance)
          break
        }
        case 'battery-aa':
        case 'battery-9v':
        case 'power-supply': {
          const plus = mna.indexOfNet(netOf(part.id, 'plus'))
          const minus = mna.indexOfNet(netOf(part.id, 'minus'))
          const spec =
            part.type === 'battery-aa'
              ? { volts: 1.5, resistanceOhms: 0.5 }
              : part.type === 'battery-9v'
                ? { volts: 9, resistanceOhms: 1 }
                : { volts: 5, resistanceOhms: 0.1 }
          const hidden = mna.newNode()
          mna.addVoltageSource(hidden, minus, spec.volts)
          mna.addConductance(hidden, plus, 1 / spec.resistanceOhms)
          break
        }
        case 'coin-cell':
        case 'solar-cell':
        case 'potato-battery': {
          const plus = mna.indexOfNet(netOf(part.id, 'plus'))
          const minus = mna.indexOfNet(netOf(part.id, 'minus'))
          const volts = sourceVoltage(part.type, sensors.get(part.id) ?? 0.5) ?? 0
          const hidden = mna.newNode()
          mna.addVoltageSource(hidden, minus, volts)
          mna.addConductance(hidden, plus, 1 / sourceResistance(part.type))
          break
        }
        case 'tmp36': {
          const out = mna.indexOfNet(netOf(part.id, 'vout'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          const volts = sourceVoltage(part.type, sensors.get(part.id) ?? 0.5) ?? 0
          const hidden = mna.newNode()
          mna.addVoltageSource(hidden, ground, volts)
          mna.addConductance(hidden, out, 1 / sourceResistance(part.type))
          break
        }
        case 'soil-moisture': {
          const out = mna.indexOfNet(netOf(part.id, 'sig'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          const volts = sourceVoltage(part.type, sensors.get(part.id) ?? 0.5) ?? 0
          const hidden = mna.newNode()
          mna.addVoltageSource(hidden, ground, volts)
          mna.addConductance(hidden, out, 1 / sourceResistance(part.type))
          break
        }
        case 'lm7805':
        case 'ld1117v33': {
          const out = mna.indexOfNet(netOf(part.id, 'out'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          const volts = sourceVoltage(part.type, 1) ?? 0
          const hidden = mna.newNode()
          mna.addVoltageSource(hidden, ground, volts)
          mna.addConductance(hidden, out, 1 / sourceResistance(part.type))
          break
        }
        case 'ultrasonic-3pin': {
          const out = mna.indexOfNet(netOf(part.id, 'sig'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          const hidden = mna.newNode()
          mna.addVoltageSource(
            hidden,
            ground,
            sourceVoltage(part.type, sensors.get(part.id) ?? 0.5) ?? 0
          )
          mna.addConductance(hidden, out, 1 / MODULE_OUTPUT_RESISTANCE_OHMS)
          break
        }
        case 'ultrasonic-hcsr04': {
          const out = mna.indexOfNet(netOf(part.id, 'echo'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          const hidden = mna.newNode()
          mna.addVoltageSource(
            hidden,
            ground,
            sourceVoltage(part.type, sensors.get(part.id) ?? 0.5) ?? 0
          )
          mna.addConductance(hidden, out, 1 / MODULE_OUTPUT_RESISTANCE_OHMS)
          break
        }
        case 'pir-sensor': {
          const out = mna.indexOfNet(netOf(part.id, 'out'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          const hidden = mna.newNode()
          mna.addVoltageSource(
            hidden,
            ground,
            sourceVoltage(part.type, sensors.get(part.id) ?? 0.5) ?? 0
          )
          mna.addConductance(hidden, out, 1 / MODULE_OUTPUT_RESISTANCE_OHMS)
          break
        }
        case 'neopixel-strip':
        case 'neopixel-ring': {
          const supply = mna.indexOfNet(netOf(part.id, 'vdd'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          mna.addConductance(supply, ground, 1 / NEOPIXEL_LOAD_RESISTANCE_OHMS)
          break
        }
        case 'encoder-motor': {
          const plus = mna.indexOfNet(netOf(part.id, 'plus'))
          const minus = mna.indexOfNet(netOf(part.id, 'minus'))
          mna.addConductance(plus, minus, 1 / MOTOR_RESISTANCE_OHMS)
          break
        }
        case 'servo': {
          const supply = mna.indexOfNet(netOf(part.id, 'vcc'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          mna.addConductance(supply, ground, 1 / SERVO_LOAD_RESISTANCE_OHMS)
          break
        }
        case 'lcd-16x2': {
          const supply = mna.indexOfNet(netOf(part.id, 'vdd'))
          const ground = mna.indexOfNet(netOf(part.id, 'vss'))
          mna.addConductance(supply, ground, 1 / LCD_LOAD_RESISTANCE_OHMS)
          break
        }
        case 'lcd-16x2-i2c':
        case 'seven-segment-clock': {
          const supply = mna.indexOfNet(netOf(part.id, 'vcc'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          mna.addConductance(supply, ground, 1 / LCD_LOAD_RESISTANCE_OHMS)
          break
        }
        case 'microbit': {
          const out = mna.indexOfNet(netOf(part.id, 'p3v'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          const hidden = mna.newNode()
          mna.addVoltageSource(hidden, ground, 3.3)
          mna.addConductance(hidden, out, 1 / 10)
          break
        }
        case 'multimeter': {
          const plus = mna.indexOfNet(netOf(part.id, 'plus'))
          const minus = mna.indexOfNet(netOf(part.id, 'minus'))
          mna.addConductance(plus, minus, 1 / METER_RESISTANCE_OHMS)
          break
        }
        case 'oscilloscope': {
          const plus = mna.indexOfNet(netOf(part.id, 'plus'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          mna.addConductance(plus, ground, 1 / SCOPE_RESISTANCE_OHMS)
          break
        }
        case 'function-generator': {
          const plus = mna.indexOfNet(netOf(part.id, 'plus'))
          const minus = mna.indexOfNet(netOf(part.id, 'minus'))
          const hidden = mna.newNode()
          mna.addVoltageSource(hidden, minus, part.props.offsetVolts)
          mna.addConductance(hidden, plus, 1 / 50)
          break
        }
        case 'transistor-npn':
        case 'transistor-pnp':
        case 'tip120':
        case 'mosfet-n':
        case 'mosfet-p': {
          const isMosfet = part.type === 'mosfet-n' || part.type === 'mosfet-p'
          const controlA = isMosfet ? 'gate' : 'base'
          const controlB = isMosfet ? 'source' : 'emitter'
          const a = mna.indexOfNet(netOf(part.id, 'collector'))
          const b = mna.indexOfNet(netOf(part.id, 'emitter'))
          const drain = mna.indexOfNet(netOf(part.id, 'drain'))
          const source = mna.indexOfNet(netOf(part.id, 'source'))
          const control = mna.indexOfNet(netOf(part.id, controlA))
          const reference = mna.indexOfNet(netOf(part.id, controlB))
          const on = transistorStates.get(part.id) === true
          mna.addConductance(control, reference, 1 / (isMosfet ? OPEN_RESISTANCE_OHMS : 10_000))
          const first = isMosfet ? drain : a
          const second = isMosfet ? source : b
          mna.addConductance(first, second, 1 / (on ? 5 : OPEN_RESISTANCE_OHMS))
          break
        }
        case 'relay-spdt': {
          const coilA = mna.indexOfNet(netOf(part.id, 'coil1'))
          const coilB = mna.indexOfNet(netOf(part.id, 'coil2'))
          mna.addConductance(coilA, coilB, 1 / RELAY_COIL_RESISTANCE_OHMS)
          const common = mna.indexOfNet(netOf(part.id, 'com'))
          const nc = mna.indexOfNet(netOf(part.id, 'nc'))
          const no = mna.indexOfNet(netOf(part.id, 'no'))
          const closed = relayStates.get(part.id) === true
          mna.addConductance(
            common,
            nc,
            1 / (closed ? OPEN_RESISTANCE_OHMS : CLOSED_SWITCH_RESISTANCE_OHMS)
          )
          mna.addConductance(
            common,
            no,
            1 / (closed ? CLOSED_SWITCH_RESISTANCE_OHMS : OPEN_RESISTANCE_OHMS)
          )
          break
        }
        case 'relay-dpdt': {
          const coilA = mna.indexOfNet(netOf(part.id, 'coil1'))
          const coilB = mna.indexOfNet(netOf(part.id, 'coil2'))
          mna.addConductance(coilA, coilB, 1 / RELAY_COIL_RESISTANCE_OHMS)
          const closed = relayStates.get(part.id) === true
          for (const channel of ['1', '2'] as const) {
            const common = mna.indexOfNet(netOf(part.id, `com${channel}`))
            const nc = mna.indexOfNet(netOf(part.id, `nc${channel}`))
            const no = mna.indexOfNet(netOf(part.id, `no${channel}`))
            mna.addConductance(
              common,
              nc,
              1 / (closed ? OPEN_RESISTANCE_OHMS : CLOSED_SWITCH_RESISTANCE_OHMS)
            )
            mna.addConductance(
              common,
              no,
              1 / (closed ? CLOSED_SWITCH_RESISTANCE_OHMS : OPEN_RESISTANCE_OHMS)
            )
          }
          break
        }
        case 'usb-a': {
          const supply = mna.indexOfNet(netOf(part.id, 'vbus'))
          const ground = mna.indexOfNet(netOf(part.id, 'gnd'))
          const hidden = mna.newNode()
          mna.addVoltageSource(hidden, ground, 5)
          mna.addConductance(hidden, supply, 1 / 0.1)
          break
        }
        case 'potentiometer': {
          const low = mna.indexOfNet(netOf(part.id, '1'))
          const wiper = mna.indexOfNet(netOf(part.id, '2'))
          const high = mna.indexOfNet(netOf(part.id, '3'))
          const position = Math.min(1, Math.max(0, pots.get(part.id) ?? 0.5))
          const resistance = part.props.resistanceOhms
          mna.addConductance(low, wiper, 1 / Math.max(resistance * position, 1))
          mna.addConductance(wiper, high, 1 / Math.max(resistance * (1 - position), 1))
          break
        }
        case 'buzzer': {
          const plus = mna.indexOfNet(netOf(part.id, 'plus'))
          const minus = mna.indexOfNet(netOf(part.id, 'minus'))
          mna.addConductance(plus, minus, 1 / BUZZER_RESISTANCE_OHMS)
          break
        }
        default:
          break
      }
    }

    for (const branch of diodeBranches) {
      if (!branch.on) continue
      const anode = mna.indexOfNet(branch.anodeNet)
      const cathode = mna.indexOfNet(branch.cathodeNet)
      const middle = mna.newNode()
      mna.addConductance(anode, middle, 1 / branch.seriesOhms)
      mna.addVoltageSource(middle, cathode, branch.forwardVolts)
    }

    return mna
  }

  let solution: Float64Array | null = null
  let netIndices: ReadonlyMap<number, number> = new Map()
  const branchCurrents = new Array<number>(diodeBranches.length).fill(0)

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const result = build().solve()
    if (result === null) break
    solution = result.volts
    netIndices = result.netIndices

    let changed = false
    for (const [index, branch] of diodeBranches.entries()) {
      const anode = netIndices.get(branch.anodeNet) ?? 0
      const cathode = netIndices.get(branch.cathodeNet) ?? 0
      const volts = (solution[anode] ?? 0) - (solution[cathode] ?? 0)
      if (!branch.on && volts > branch.forwardVolts + 0.001) {
        branch.on = true
        changed = true
      } else if (branch.on) {
        const middleVolts = (solution[cathode] ?? 0) + branch.forwardVolts
        const current = ((solution[anode] ?? 0) - middleVolts) / branch.seriesOhms
        if (current < 0) {
          branch.on = false
          changed = true
        } else {
          branchCurrents[index] = current
        }
      }
    }
    const voltsAt = (netId: number | undefined): number => {
      if (netId === undefined) return 0
      return solution?.[netIndices.get(netId) ?? 0] ?? 0
    }
    for (const part of document.parts) {
      const gates = GATE_TOPOLOGY[part.type]
      if (gates === undefined) continue
      const previous = gateStates.get(part.id) ?? gates.map(() => false)
      const next = gates.map((gate) => {
        const values = gate.inputs.map((pinId) => voltsAt(netOf(part.id, pinId)) > 2.5)
        const high = values.filter(Boolean).length
        switch (gate.op) {
          case 'nand':
            return !values.every(Boolean)
          case 'nor':
            return !values.some(Boolean)
          case 'and':
            return values.every(Boolean)
          case 'or':
            return values.some(Boolean)
          case 'xor':
            return high % 2 === 1
          case 'not':
            return !(values[0] ?? false)
          default:
            return false
        }
      })
      if (next.some((value, index) => value !== previous[index])) {
        gateStates.set(part.id, next)
        changed = true
      }
    }
    for (const part of document.parts) {
      if (part.type !== 'relay-spdt' && part.type !== 'relay-dpdt') continue
      const coil = Math.abs(voltsAt(netOf(part.id, 'coil1')) - voltsAt(netOf(part.id, 'coil2')))
      const next = coil > 2.5
      if (next !== (relayStates.get(part.id) ?? false)) {
        relayStates.set(part.id, next)
        changed = true
      }
    }
    for (const part of document.parts) {
      let next: boolean | null = null
      if (
        part.type === 'transistor-npn' ||
        part.type === 'transistor-pnp' ||
        part.type === 'tip120'
      ) {
        const base = voltsAt(netOf(part.id, 'base'))
        const emitter = voltsAt(netOf(part.id, 'emitter'))
        const forward = part.type === 'transistor-pnp' ? emitter - base : base - emitter
        next = forward > (part.type === 'tip120' ? 1.2 : 0.7)
      } else if (part.type === 'mosfet-n' || part.type === 'mosfet-p') {
        const gate = voltsAt(netOf(part.id, 'gate'))
        const source = voltsAt(netOf(part.id, 'source'))
        const forward = part.type === 'mosfet-p' ? source - gate : gate - source
        next = forward > 2
      }
      if (next !== null && next !== (transistorStates.get(part.id) ?? false)) {
        transistorStates.set(part.id, next)
        changed = true
      }
    }
    if (!changed) break
  }

  if (solution === null) {
    return {
      ledCurrents: new Map(),
      buzzerCurrents: new Map(),
      motorCurrents: new Map(),
      netVoltages: new Map(),
    }
  }

  const netVoltages = new Map<number, number>()
  for (const net of new Set(netlist.netIdByPin.values())) {
    netVoltages.set(net, solution[netIndices.get(net) ?? 0] ?? 0)
  }

  const ledCurrentsByPart = new Map<string, number>()
  for (const [index, branch] of diodeBranches.entries()) {
    if (!branch.emitsLight) continue
    const current = Math.max(0, branchCurrents[index] ?? 0)
    ledCurrentsByPart.set(branch.key, current * pwmFactor(branch.anodeNet, branch.cathodeNet))
  }

  for (const part of document.parts) {
    if (part.type !== 'light-bulb') continue
    const a = netOf(part.id, '1')
    const b = netOf(part.id, '2')
    if (a === undefined || b === undefined) continue
    const volts = Math.abs((netVoltages.get(a) ?? 0) - (netVoltages.get(b) ?? 0))
    ledCurrentsByPart.set(part.id, (volts / part.props.resistanceOhms) * pwmFactor(a, b))
  }

  const buzzerCurrents = new Map<string, number>()
  for (const part of document.parts) {
    if (part.type !== 'buzzer') continue
    const plus = netOf(part.id, 'plus')
    const minus = netOf(part.id, 'minus')
    if (plus === undefined || minus === undefined) continue
    const volts = (netVoltages.get(plus) ?? 0) - (netVoltages.get(minus) ?? 0)
    buzzerCurrents.set(part.id, (Math.abs(volts) / BUZZER_RESISTANCE_OHMS) * pwmFactor(plus, minus))
  }

  const motorCurrents = new Map<string, number>()
  for (const part of document.parts) {
    if (
      part.type !== 'dc-motor' &&
      part.type !== 'vibration-motor' &&
      part.type !== 'gear-motor' &&
      part.type !== 'encoder-motor'
    ) {
      continue
    }
    const plus = netOf(part.id, 'plus')
    const minus = netOf(part.id, 'minus')
    if (plus === undefined || minus === undefined) continue
    const volts = (netVoltages.get(plus) ?? 0) - (netVoltages.get(minus) ?? 0)
    const resistance =
      part.type === 'vibration-motor'
        ? VIBRATION_MOTOR_RESISTANCE_OHMS
        : part.type === 'gear-motor'
          ? GEAR_MOTOR_RESISTANCE_OHMS
          : MOTOR_RESISTANCE_OHMS
    motorCurrents.set(part.id, (Math.abs(volts) / resistance) * pwmFactor(plus, minus))
  }

  return { ledCurrents: ledCurrentsByPart, buzzerCurrents, motorCurrents, netVoltages }
}
