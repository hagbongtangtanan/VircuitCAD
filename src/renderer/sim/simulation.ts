import {
  AVRIOPort,
  AVRTimer,
  AVRUSART,
  CPU,
  PinState,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  usart0Config,
} from 'avr8js'
import type { CircuitDocument } from '../../shared/circuit'
import { pinKey } from '../../shared/circuit'
import { parseIntelHex, toProgramWords } from '../../shared/intelhex'
import { buildNetlist } from '../wiring/netlist'
import type { DriverMap, SolveResult } from './solver'
import { solveCircuit } from './solver'
import {
  GROUND_RESISTANCE_OHMS,
  PIN_OUTPUT_RESISTANCE_OHMS,
  PIN_PULLUP_RESISTANCE_OHMS,
  UNO_IO_PIN_IDS,
  UNO_PIN_SPECS,
  VCC_3V3_RESISTANCE_OHMS,
  VCC_5V_RESISTANCE_OHMS,
  unoPinSpec,
} from './unoPins'

export const CLOCK_HZ = 16_000_000
/** Nominal current for a fully lit LED; 20 mA is the usual "bright" LED. */
const LED_FULL_BRIGHTNESS_AMPS = 0.02

export interface SimulationFrame {
  /** 0 to 1 per LED part id. */
  readonly ledBrightness: ReadonlyMap<string, number>
  /** Volts driven onto each Uno pin, null while the pin is high-impedance. */
  readonly pinVoltages: ReadonlyMap<string, number | null>
  readonly elapsedMs: number
}

function brightnessFor(amps: number): number {
  const linear = Math.min(1, Math.max(0, amps / LED_FULL_BRIGHTNESS_AMPS))
  return Math.pow(linear, 0.7)
}

/**
 * Runs a compiled sketch on an emulated ATmega328P and resolves the attached
 * circuit against the pin outputs. Framework-free on purpose: tests drive it
 * for a fixed number of cycles instead of waiting on animation frames.
 */
export class ArduinoSimulation {
  private readonly cpu: CPU
  private readonly ports: Record<'B' | 'C' | 'D', AVRIOPort>
  /** Timers have to stay alive so delay()/millis() and PWM behave. */
  readonly timers: readonly AVRTimer[]
  readonly usart: AVRUSART
  private readonly document: CircuitDocument
  private readonly netlist: ReturnType<typeof buildNetlist>
  private lastDriversSignature = ''
  private lastSolve: SolveResult | null = null

  onSerialByte: ((byte: number) => void) | null = null

  constructor(hex: string, document: CircuitDocument) {
    this.document = document
    this.netlist = buildNetlist(document)
    this.cpu = new CPU(toProgramWords(parseIntelHex(hex)), 2048)
    this.ports = {
      B: new AVRIOPort(this.cpu, portBConfig),
      C: new AVRIOPort(this.cpu, portCConfig),
      D: new AVRIOPort(this.cpu, portDConfig),
    }
    this.timers = [
      new AVRTimer(this.cpu, timer0Config),
      new AVRTimer(this.cpu, timer1Config),
      new AVRTimer(this.cpu, timer2Config),
    ]
    this.usart = new AVRUSART(this.cpu, usart0Config, CLOCK_HZ)
    this.usart.onByteTransmit = (byte) => {
      this.onSerialByte?.(byte)
    }
  }

  get elapsedMs(): number {
    return (this.cpu.cycles / CLOCK_HZ) * 1000
  }

  get cycles(): number {
    return this.cpu.cycles
  }

  /** Executes instructions until the given absolute cycle count is reached. */
  runUntil(cycles: number): void {
    while (this.cpu.cycles < cycles) {
      avrInstruction(this.cpu)
      this.cpu.tick()
    }
  }

  runForCycles(cycles: number): void {
    this.runUntil(this.cpu.cycles + cycles)
  }

  private drivers(): { drivers: DriverMap; pinVoltages: Map<string, number | null> } {
    const drivers = new Map<string, { volts: number; resistanceOhms: number }>()
    const pinVoltages = new Map<string, number | null>()

    for (const part of this.document.parts) {
      if (part.type !== 'arduino-uno') continue

      for (const pinId of UNO_IO_PIN_IDS) {
        const spec = unoPinSpec(pinId)
        if (spec?.kind !== 'io') continue
        const state = this.ports[spec.port].pinState(spec.bit)
        const key = pinKey({ partId: part.id, pinId })

        switch (state) {
          case PinState.High:
            pinVoltages.set(key, 5)
            drivers.set(key, { volts: 5, resistanceOhms: PIN_OUTPUT_RESISTANCE_OHMS })
            break
          case PinState.Low:
            pinVoltages.set(key, 0)
            drivers.set(key, { volts: 0, resistanceOhms: PIN_OUTPUT_RESISTANCE_OHMS })
            break
          case PinState.InputPullUp:
            pinVoltages.set(key, 5)
            drivers.set(key, { volts: 5, resistanceOhms: PIN_PULLUP_RESISTANCE_OHMS })
            break
          default:
            pinVoltages.set(key, null)
            break
        }
      }

      for (const [pinId, spec] of Object.entries(UNO_PIN_SPECS)) {
        const key = pinKey({ partId: part.id, pinId })
        if (spec.kind === 'vcc') {
          drivers.set(key, {
            volts: spec.volts,
            resistanceOhms: spec.volts === 5 ? VCC_5V_RESISTANCE_OHMS : VCC_3V3_RESISTANCE_OHMS,
          })
        } else if (spec.kind === 'gnd') {
          drivers.set(key, { volts: 0, resistanceOhms: GROUND_RESISTANCE_OHMS })
        }
      }
    }

    return { drivers, pinVoltages }
  }

  /** Reads the pin registers, solves the circuit and reports the visible state. */
  frame(): SimulationFrame {
    const { drivers, pinVoltages } = this.drivers()

    let signature = ''
    for (const [key, driver] of drivers) signature += `${key}=${driver.volts};`
    if (signature !== this.lastDriversSignature) {
      this.lastSolve = solveCircuit(this.document, this.netlist, drivers)
      this.lastDriversSignature = signature
    }

    const ledBrightness = new Map<string, number>()
    for (const [partId, amps] of this.lastSolve?.ledCurrents ?? []) {
      ledBrightness.set(partId, brightnessFor(amps))
    }

    return { ledBrightness, pinVoltages, elapsedMs: this.elapsedMs }
  }
}
