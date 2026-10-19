import type { CircuitDocument, LedColor } from '../../shared/circuit'
import { pinKey } from '../../shared/circuit'
import type { Netlist } from '../wiring/netlist'

/**
 * A tiny piecewise-linear circuit solver. It is not SPICE: LEDs are a forward
 * voltage plus a small series resistance, switches are either closed or open,
 * and the Arduino pins are Thevenin sources. That is enough to light LEDs the
 * way a real board would and cheap enough to re-solve whenever a pin toggles.
 */

export interface PinDriver {
  readonly volts: number
  readonly resistanceOhms: number
}

/** Pin key (`partId:pinId`) to the source pushing that net around. */
export type DriverMap = ReadonlyMap<string, PinDriver>

export interface SolveOptions {
  /** Parts whose push button is held down. */
  readonly pressedParts?: ReadonlySet<string>
  /** Potentiometer wiper position, 0 to 1. */
  readonly potPositions?: ReadonlyMap<string, number>
}

export interface SolveResult {
  /** Amps through each LED, keyed by part id. */
  readonly ledCurrents: ReadonlyMap<string, number>
  /** Amps through each buzzer, keyed by part id. */
  readonly buzzerCurrents: ReadonlyMap<string, number>
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

interface LedBranch {
  readonly partId: string
  readonly anodeNet: number
  readonly cathodeNet: number
  readonly forwardVolts: number
  on: boolean
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
  const groundNets = findGroundNets(document, netlist, drivers)

  const netOf = (partId: string, pinId: string): number | undefined =>
    netlist.netIdOf({ partId, pinId })

  const ledBranches: LedBranch[] = []
  for (const part of document.parts) {
    if (part.type !== 'led') continue
    const anodeNet = netOf(part.id, 'anode')
    const cathodeNet = netOf(part.id, 'cathode')
    if (anodeNet === undefined || cathodeNet === undefined) continue
    ledBranches.push({
      partId: part.id,
      anodeNet,
      cathodeNet,
      forwardVolts: LED_FORWARD_VOLTAGE[part.props.color],
      on: false,
    })
  }

  const capacity = netlist.netCount + drivers.size * 3 + ledBranches.length * 4 + 8

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

    for (const branch of ledBranches) {
      if (!branch.on) continue
      const anode = mna.indexOfNet(branch.anodeNet)
      const cathode = mna.indexOfNet(branch.cathodeNet)
      const middle = mna.newNode()
      mna.addConductance(anode, middle, 1 / LED_SERIES_RESISTANCE_OHMS)
      mna.addVoltageSource(middle, cathode, branch.forwardVolts)
    }

    return mna
  }

  let solution: Float64Array | null = null
  let netIndices: ReadonlyMap<number, number> = new Map()
  const ledCurrents = new Array<number>(ledBranches.length).fill(0)

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const result = build().solve()
    if (result === null) break
    solution = result.volts
    netIndices = result.netIndices

    let changed = false
    for (const [index, branch] of ledBranches.entries()) {
      const anode = netIndices.get(branch.anodeNet) ?? 0
      const cathode = netIndices.get(branch.cathodeNet) ?? 0
      const volts = (solution[anode] ?? 0) - (solution[cathode] ?? 0)
      if (!branch.on && volts > branch.forwardVolts + 0.001) {
        branch.on = true
        changed = true
      } else if (branch.on) {
        const middleVolts = (solution[cathode] ?? 0) + branch.forwardVolts
        const current = ((solution[anode] ?? 0) - middleVolts) / LED_SERIES_RESISTANCE_OHMS
        if (current < 0) {
          branch.on = false
          changed = true
        } else {
          ledCurrents[index] = current
        }
      }
    }
    if (!changed) break
  }

  if (solution === null) {
    return { ledCurrents: new Map(), buzzerCurrents: new Map(), netVoltages: new Map() }
  }

  const netVoltages = new Map<number, number>()
  for (const net of new Set(netlist.netIdByPin.values())) {
    netVoltages.set(net, solution[netIndices.get(net) ?? 0] ?? 0)
  }

  const ledCurrentsByPart = new Map<string, number>()
  for (const [index, branch] of ledBranches.entries()) {
    ledCurrentsByPart.set(branch.partId, Math.max(0, ledCurrents[index] ?? 0))
  }

  const buzzerCurrents = new Map<string, number>()
  for (const part of document.parts) {
    if (part.type !== 'buzzer') continue
    const plus = netOf(part.id, 'plus')
    const minus = netOf(part.id, 'minus')
    if (plus === undefined || minus === undefined) continue
    const volts = (netVoltages.get(plus) ?? 0) - (netVoltages.get(minus) ?? 0)
    buzzerCurrents.set(part.id, Math.abs(volts) / BUZZER_RESISTANCE_OHMS)
  }

  return { ledCurrents: ledCurrentsByPart, buzzerCurrents, netVoltages }
}
