import {
  AVRADC,
  AVRIOPort,
  AVRTimer,
  AVRUSART,
  CPU,
  PinState,
  adcConfig,
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
import type { DriverMap, PinDriver, SolveOptions, SolveResult } from './solver'
import { solveCircuit } from './solver'
import {
  GROUND_RESISTANCE_OHMS,
  PIN_OUTPUT_RESISTANCE_OHMS,
  PIN_PULLUP_RESISTANCE_OHMS,
  UNO_IO_PIN_IDS,
  UNO_PIN_SPECS,
  UNO_PWM_ROUTES,
  VCC_3V3_RESISTANCE_OHMS,
  VCC_5V_RESISTANCE_OHMS,
  isPwmPin,
  unoPinSpec,
} from './unoPins'

export const CLOCK_HZ = 16_000_000
/** A0-A5 are ADC channels 0-5 on the ATmega328P (port C). */
const ANALOG_PIN_IDS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'] as const
/** TTL-ish threshold: anything above this reads as a digital 1. */
const DIGITAL_INPUT_HIGH_VOLTS = 2.5
/** Nominal current for a fully lit LED; 20 mA is the usual "bright" LED. */
const LED_FULL_BRIGHTNESS_AMPS = 0.02
/** 5 V across a 20 Ω motor draws 250 mA; treat that as full speed. */
const MOTOR_FULL_CURRENT_AMPS = 0.25

export interface SimulationFrame {
  /** 0 to 1 per LED part id. */
  readonly ledBrightness: ReadonlyMap<string, number>
  /** Volts driven onto each Uno pin, null while the pin is high-impedance. */
  readonly pinVoltages: ReadonlyMap<string, number | null>
  /** 0 to 1 rotor speed per DC motor part id. */
  readonly motorSpeed: ReadonlyMap<string, number>
  readonly elapsedMs: number
}

function brightnessFor(amps: number): number {
  const linear = Math.min(1, Math.max(0, amps / LED_FULL_BRIGHTNESS_AMPS))
  return Math.pow(linear, 0.7)
}

const PWM_TIMER_CONFIGS = [timer0Config, timer1Config, timer2Config] as const

/**
 * Reads the timer's output compare registers and returns the pin's duty cycle,
 * or null when the pin is not currently driven by a PWM waveform. Arduino's
 * core puts timer 0 in fast PWM and timers 1 and 2 in 8-bit phase-correct PWM,
 * all with TOP = 0xFF, so OCR maps directly onto 0..255.
 */
function pwmDutyOf(
  config: (typeof PWM_TIMER_CONFIGS)[number],
  channel: 'A' | 'B',
  data: Uint8Array
): number | null {
  const tccra = data[config.TCCRA] ?? 0
  const tccrb = data[config.TCCRB] ?? 0
  const com = channel === 'A' ? (tccra >> 6) & 0x03 : (tccra >> 4) & 0x03
  // COM = 0 disconnects the timer; digitalWrite() also clears these bits.
  if (com < 2) return null

  const wgm =
    config.bits === 16
      ? (tccra & 0x03) | ((tccrb & 0x18) >> 1)
      : (tccra & 0x03) | ((tccrb & 0x08) >> 1)
  const phaseCorrect = wgm === 1
  const fastPwm = wgm === 3
  if (!phaseCorrect && !fastPwm) return null

  const ocrAddress = channel === 'A' ? config.OCRA : config.OCRB
  const ocr =
    config.bits === 16
      ? (data[ocrAddress] ?? 0) | ((data[ocrAddress + 1] ?? 0) << 8)
      : (data[ocrAddress] ?? 0)
  const top = 0xff
  const raw = phaseCorrect ? ocr / top : ocr / (top + 1)
  const duty = com === 2 ? raw : 1 - raw
  return Math.min(1, Math.max(0, duty))
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
  private readonly adc: AVRADC
  private readonly document: CircuitDocument
  private readonly netlist: ReturnType<typeof buildNetlist>
  private lastDriversSignature = ''
  private lastSolve: SolveResult | null = null

  onSerialByte: ((byte: number) => void) | null = null
  /** Pulled every frame so UI input (buttons, pots) reaches the solver. */
  readInputs: (() => SolveOptions) | null = null

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
    this.adc = new AVRADC(this.cpu, adcConfig)
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
    const drivers = new Map<string, PinDriver>()
    const pinVoltages = new Map<string, number | null>()

    for (const part of this.document.parts) {
      if (part.type !== 'arduino-uno') continue

      for (const pinId of UNO_IO_PIN_IDS) {
        const spec = unoPinSpec(pinId)
        if (spec?.kind !== 'io') continue
        const state = this.ports[spec.port].pinState(spec.bit)
        const key = pinKey({ partId: part.id, pinId })

        // A timer-driven output is a duty cycle, not a steady 5 V. Solve at the
        // high level and let the solver scale LED/buzzer/motor current by duty.
        if (isPwmPin(pinId) && (state === PinState.High || state === PinState.Low)) {
          const route = UNO_PWM_ROUTES[pinId]
          const duty = pwmDutyOf(PWM_TIMER_CONFIGS[route.timer], route.channel, this.cpu.data)
          if (duty !== null) {
            pinVoltages.set(key, 5 * duty)
            drivers.set(key, {
              volts: duty > 0 ? 5 : 0,
              resistanceOhms: PIN_OUTPUT_RESISTANCE_OHMS,
              duty,
            })
            continue
          }
        }

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

  /**
   * Feeds the solved net voltages back into the CPU: analog channels drive
   * analogRead(), and input pins read the level the external circuit imposes.
   * The ADC conversion itself happens while the sketch runs, so readings are
   * one animation frame behind the wiper; that is far below human perception.
   */
  private syncInputs(): void {
    const uno = this.document.parts.find((part) => part.type === 'arduino-uno')
    if (uno === undefined) return

    for (const [channel, pinId] of ANALOG_PIN_IDS.entries()) {
      const net = this.netlist.netIdOf({ partId: uno.id, pinId })
      const volts = net === undefined ? 0 : (this.lastSolve?.netVoltages.get(net) ?? 0)
      this.adc.channelValues[channel] = Math.min(5, Math.max(0, volts))
    }

    for (const pinId of UNO_IO_PIN_IDS) {
      const spec = unoPinSpec(pinId)
      if (spec?.kind !== 'io') continue
      const port = this.ports[spec.port]
      const state = port.pinState(spec.bit)
      if (state === PinState.High || state === PinState.Low) continue
      const net = this.netlist.netIdOf({ partId: uno.id, pinId })
      const volts = net === undefined ? 0 : (this.lastSolve?.netVoltages.get(net) ?? 0)
      port.setPin(spec.bit, volts > DIGITAL_INPUT_HIGH_VOLTS)
    }
  }

  /** Solves without advancing the CPU, so the first analogRead has real data. */
  prime(): void {
    this.frame()
  }

  /** Reads the pin registers, solves the circuit and reports the visible state. */
  frame(): SimulationFrame {
    const { drivers, pinVoltages } = this.drivers()
    const inputs = this.readInputs?.() ?? {}

    let signature = ''
    for (const [key, driver] of drivers) {
      // PWM pins stay at the high voltage while their duty changes, so the
      // duty has to be part of the cache key or brightness freezes between
      // analogWrite() calls.
      signature += `${key}=${driver.volts}:${driver.duty ?? 'steady'};`
    }
    const pressed = [...(inputs.pressedParts ?? [])].sort().join(',')
    const pots = [...(inputs.potPositions ?? [])]
      .map(([partId, value]) => `${partId}=${value.toFixed(3)}`)
      .sort()
      .join(',')
    const switches = [...(inputs.switchStates ?? [])]
      .map(([partId, value]) => `${partId}=${value ? 1 : 0}`)
      .sort()
      .join(',')
    const sensors = [...(inputs.sensorLevels ?? [])]
      .map(([partId, value]) => `${partId}=${value.toFixed(3)}`)
      .sort()
      .join(',')
    const dipBits = [...(inputs.dipBits ?? [])]
      .map(([partId, bits]) => `${partId}=${bits.map((bit) => (bit ? 1 : 0)).join('')}`)
      .sort()
      .join(',')
    const keypadKeys = [...(inputs.keypadKeys ?? [])]
      .map(([partId, key]) => `${partId}=${key}`)
      .sort()
      .join(',')
    signature += `|pressed:${pressed}|pots:${pots}|switches:${switches}|sensors:${sensors}|dip:${dipBits}|keys:${keypadKeys}`
    if (signature !== this.lastDriversSignature) {
      this.lastSolve = solveCircuit(this.document, this.netlist, drivers, inputs)
      this.lastDriversSignature = signature
      this.syncInputs()
    }

    const ledBrightness = new Map<string, number>()
    for (const [partId, amps] of this.lastSolve?.ledCurrents ?? []) {
      ledBrightness.set(partId, brightnessFor(amps))
    }

    const motorSpeed = new Map<string, number>()
    for (const [partId, amps] of this.lastSolve?.motorCurrents ?? []) {
      motorSpeed.set(partId, Math.min(1, amps / MOTOR_FULL_CURRENT_AMPS))
    }

    return { ledBrightness, pinVoltages, motorSpeed, elapsedMs: this.elapsedMs }
  }
}
