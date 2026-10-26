import { timer0Config } from 'avr8js'
import { describe, expect, it } from 'vitest'
import { circuitDocumentSchema, type CircuitDocument } from '../../shared/circuit'
import { ANALOG_READ_HEX, DIGITAL_INPUT_HEX, PWM_HEX, SIMULATION_HEX } from './fixtures'
import { CLOCK_HZ, ArduinoSimulation } from './simulation'

function blinkCircuit(): CircuitDocument {
  return circuitDocumentSchema.parse({
    version: 1,
    parts: [
      { id: 'uno', type: 'arduino-uno', position: { x: 0, y: 0 }, rotation: 0, props: {} },
      {
        id: 'r1',
        type: 'resistor',
        position: { x: 400, y: 0 },
        rotation: 0,
        props: { resistanceOhms: 220 },
      },
      {
        id: 'led1',
        type: 'led',
        position: { x: 500, y: 0 },
        rotation: 0,
        props: { color: 'red' },
      },
    ],
    wires: [
      {
        id: 'w1',
        from: { partId: 'uno', pinId: 'D13' },
        to: { partId: 'r1', pinId: 'lead1' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w2',
        from: { partId: 'r1', pinId: 'lead2' },
        to: { partId: 'led1', pinId: 'anode' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w3',
        from: { partId: 'led1', pinId: 'cathode' },
        to: { partId: 'uno', pinId: 'GND' },
        color: '#4f9cf9',
        waypoints: [],
      },
    ],
  })
}

function pwmCircuit(): CircuitDocument {
  return circuitDocumentSchema.parse({
    version: 1,
    parts: [
      { id: 'uno', type: 'arduino-uno', position: { x: 0, y: 0 }, rotation: 0, props: {} },
      {
        id: 'r6',
        type: 'resistor',
        position: { x: 400, y: 0 },
        rotation: 0,
        props: { resistanceOhms: 220 },
      },
      {
        id: 'led6',
        type: 'led',
        position: { x: 500, y: 0 },
        rotation: 0,
        props: { color: 'red' },
      },
      {
        id: 'r3',
        type: 'resistor',
        position: { x: 400, y: 80 },
        rotation: 0,
        props: { resistanceOhms: 220 },
      },
      {
        id: 'led3',
        type: 'led',
        position: { x: 500, y: 80 },
        rotation: 0,
        props: { color: 'red' },
      },
    ],
    wires: [
      {
        id: 'w1',
        from: { partId: 'uno', pinId: 'D6' },
        to: { partId: 'r6', pinId: 'lead1' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w2',
        from: { partId: 'r6', pinId: 'lead2' },
        to: { partId: 'led6', pinId: 'anode' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w3',
        from: { partId: 'led6', pinId: 'cathode' },
        to: { partId: 'uno', pinId: 'GND' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w4',
        from: { partId: 'uno', pinId: 'D3' },
        to: { partId: 'r3', pinId: 'lead1' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w5',
        from: { partId: 'r3', pinId: 'lead2' },
        to: { partId: 'led3', pinId: 'anode' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w6',
        from: { partId: 'led3', pinId: 'cathode' },
        to: { partId: 'uno', pinId: 'GND' },
        color: '#4f9cf9',
        waypoints: [],
      },
    ],
  })
}

describe('ArduinoSimulation', () => {
  it('runs Blink and lights the LED only while the pin is high', () => {
    const simulation = new ArduinoSimulation(SIMULATION_HEX, blinkCircuit())
    simulation.runForCycles(CLOCK_HZ / 100)

    const first = simulation.frame()
    expect(first.pinVoltages.get('uno:D13')).toBe(5)
    expect(first.ledBrightness.get('led1') ?? 0).toBeGreaterThan(0.5)
    expect(first.elapsedMs).toBeGreaterThan(5)

    // Wait past the 400 ms on-time; the loop should have driven the pin low.
    simulation.runForCycles(CLOCK_HZ / 2)
    const second = simulation.frame()
    expect(second.pinVoltages.get('uno:D13')).toBe(0)
    expect(second.ledBrightness.get('led1') ?? 0).toBe(0)
  })

  it('updates brightness when analogWrite changes duty without changing pin state', () => {
    const simulation = new ArduinoSimulation(PWM_HEX, pwmCircuit())
    simulation.runForCycles(CLOCK_HZ / 100)

    const before = simulation.frame()
    const beforeBrightness = before.ledBrightness.get('led6') ?? 0
    expect(before.pinVoltages.get('uno:D6')).toBeCloseTo(1.25, 1)

    // D6 is timer 0 channel A. Raising OCR while the pin stays high models the
    // next analogWrite() value in a fade.
    const data = (
      simulation as unknown as {
        cpu: { data: Uint8Array }
      }
    ).cpu.data
    data[timer0Config.OCRA] = 128

    const after = simulation.frame()
    expect(after.pinVoltages.get('uno:D6')).toBeCloseTo(2.5, 1)
    expect(after.ledBrightness.get('led6') ?? 0).toBeGreaterThan(beforeBrightness + 0.1)
  })

  it('delivers Serial output to the byte callback', () => {
    const bytes: number[] = []
    const simulation = new ArduinoSimulation(SIMULATION_HEX, blinkCircuit())
    simulation.onSerialByte = (byte) => bytes.push(byte)
    simulation.runForCycles(CLOCK_HZ / 20)

    expect(String.fromCharCode(...bytes)).toContain('hello sim\r\n')
  })

  it('dims LEDs from analogWrite on both timer 0 and timer 2 pins', () => {
    const simulation = new ArduinoSimulation(PWM_HEX, pwmCircuit())
    simulation.runForCycles(CLOCK_HZ / 100)

    const frame = simulation.frame()
    // analogWrite(6, 64) on fast-PWM timer 0 and analogWrite(3, 192) on
    // phase-correct timer 2; pin voltages are the time-weighted averages.
    expect(frame.pinVoltages.get('uno:D6')).toBeCloseTo(1.25, 1)
    expect(frame.pinVoltages.get('uno:D3')).toBeCloseTo(3.76, 1)

    const dim = frame.ledBrightness.get('led6') ?? 0
    const bright = frame.ledBrightness.get('led3') ?? 0
    expect(dim).toBeGreaterThan(0.1)
    expect(dim).toBeLessThan(0.45)
    expect(bright).toBeGreaterThan(0.5)
    expect(bright).toBeLessThan(0.8)
  })
})

function analogCircuit(): CircuitDocument {
  return circuitDocumentSchema.parse({
    version: 1,
    parts: [
      { id: 'uno', type: 'arduino-uno', position: { x: 0, y: 0 }, rotation: 0, props: {} },
      {
        id: 'pot',
        type: 'potentiometer',
        position: { x: 400, y: 0 },
        rotation: 0,
        props: { resistanceOhms: 10_000 },
      },
    ],
    wires: [
      {
        id: 'w1',
        from: { partId: 'uno', pinId: '5V' },
        to: { partId: 'pot', pinId: '3' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w2',
        from: { partId: 'pot', pinId: '1' },
        to: { partId: 'uno', pinId: 'GND' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w3',
        from: { partId: 'pot', pinId: '2' },
        to: { partId: 'uno', pinId: 'A0' },
        color: '#4f9cf9',
        waypoints: [],
      },
    ],
  })
}

function buttonCircuit(): CircuitDocument {
  return circuitDocumentSchema.parse({
    version: 1,
    parts: [
      { id: 'uno', type: 'arduino-uno', position: { x: 0, y: 0 }, rotation: 0, props: {} },
      { id: 'btn', type: 'push-button', position: { x: 400, y: 0 }, rotation: 0, props: {} },
    ],
    wires: [
      {
        id: 'w1',
        from: { partId: 'uno', pinId: 'D2' },
        to: { partId: 'btn', pinId: '1A' },
        color: '#4f9cf9',
        waypoints: [],
      },
      {
        id: 'w2',
        from: { partId: 'btn', pinId: '2A' },
        to: { partId: 'uno', pinId: 'GND' },
        color: '#4f9cf9',
        waypoints: [],
      },
    ],
  })
}

function lastLine(bytes: readonly number[]): string {
  return (
    String.fromCharCode(...bytes)
      .trimEnd()
      .split('\n')
      .at(-1) ?? ''
  )
}

describe('ArduinoSimulation inputs', () => {
  it('delivers the potentiometer voltage to analogRead', () => {
    let wiper = 0.25
    const simulation = new ArduinoSimulation(ANALOG_READ_HEX, analogCircuit())
    const bytes: number[] = []
    simulation.onSerialByte = (byte) => bytes.push(byte)
    simulation.readInputs = () => ({ potPositions: new Map([['pot', wiper]]) })
    simulation.prime()

    simulation.runForCycles(CLOCK_HZ / 5)
    expect(Number(lastLine(bytes))).toBeGreaterThanOrEqual(250)
    expect(Number(lastLine(bytes))).toBeLessThanOrEqual(260)

    wiper = 0.75
    simulation.frame()
    bytes.length = 0
    simulation.runForCycles(CLOCK_HZ / 5)
    expect(Number(lastLine(bytes))).toBeGreaterThanOrEqual(760)
    expect(Number(lastLine(bytes))).toBeLessThanOrEqual(770)
  })

  it('lets a push button pull a digital input low', () => {
    let pressed = false
    const simulation = new ArduinoSimulation(DIGITAL_INPUT_HEX, buttonCircuit())
    const bytes: number[] = []
    simulation.onSerialByte = (byte) => bytes.push(byte)
    simulation.readInputs = () => ({
      pressedParts: pressed ? new Set(['btn']) : new Set(),
    })
    simulation.prime()

    for (let step = 0; step < 8; step += 1) {
      simulation.runForCycles(CLOCK_HZ / 100)
      simulation.frame()
    }
    expect(lastLine(bytes)).toBe('1')

    pressed = true
    simulation.frame()
    bytes.length = 0
    for (let step = 0; step < 8; step += 1) {
      simulation.runForCycles(CLOCK_HZ / 100)
      simulation.frame()
    }
    expect(lastLine(bytes)).toBe('0')
  })
})

describe('ArduinoSimulation re-solves circuit inputs', () => {
  function switchCircuit(): CircuitDocument {
    return circuitDocumentSchema.parse({
      version: 1,
      parts: [
        { id: 'ps', type: 'power-supply', position: { x: 0, y: 0 }, rotation: 0, props: {} },
        { id: 'sw', type: 'slide-switch', position: { x: 200, y: 0 }, rotation: 0, props: {} },
        {
          id: 'r1',
          type: 'resistor',
          position: { x: 400, y: 0 },
          rotation: 0,
          props: { resistanceOhms: 220 },
        },
        {
          id: 'led',
          type: 'led',
          position: { x: 500, y: 0 },
          rotation: 0,
          props: { color: 'red' },
        },
      ],
      wires: [
        {
          id: 'w1',
          from: { partId: 'ps', pinId: 'plus' },
          to: { partId: 'sw', pinId: '1' },
          color: '#4f9cf9',
          waypoints: [],
        },
        {
          id: 'w2',
          from: { partId: 'sw', pinId: '2' },
          to: { partId: 'r1', pinId: 'lead1' },
          color: '#4f9cf9',
          waypoints: [],
        },
        {
          id: 'w3',
          from: { partId: 'r1', pinId: 'lead2' },
          to: { partId: 'led', pinId: 'anode' },
          color: '#4f9cf9',
          waypoints: [],
        },
        {
          id: 'w4',
          from: { partId: 'led', pinId: 'cathode' },
          to: { partId: 'ps', pinId: 'minus' },
          color: '#4f9cf9',
          waypoints: [],
        },
      ],
    })
  }

  it('turns an LED on when a slide switch closes', () => {
    let closed = false
    const simulation = new ArduinoSimulation(SIMULATION_HEX, switchCircuit())
    simulation.readInputs = () => ({ switchStates: new Map([['sw', closed]]) })

    expect(simulation.frame().ledBrightness.get('led') ?? 0).toBeLessThan(0.001)

    closed = true
    expect(simulation.frame().ledBrightness.get('led') ?? 0).toBeGreaterThan(0.5)
  })

  it('turns an LED on when a photoresistor sees light', () => {
    let level = 0
    const document = circuitDocumentSchema.parse({
      version: 1,
      parts: [
        { id: 'ps', type: 'power-supply', position: { x: 0, y: 0 }, rotation: 0, props: {} },
        { id: 'ldr', type: 'ldr', position: { x: 200, y: 0 }, rotation: 0, props: {} },
        {
          id: 'r1',
          type: 'resistor',
          position: { x: 400, y: 0 },
          rotation: 0,
          props: { resistanceOhms: 220 },
        },
        {
          id: 'led',
          type: 'led',
          position: { x: 500, y: 0 },
          rotation: 0,
          props: { color: 'red' },
        },
      ],
      wires: [
        {
          id: 'w1',
          from: { partId: 'ps', pinId: 'plus' },
          to: { partId: 'ldr', pinId: '1' },
          color: '#4f9cf9',
          waypoints: [],
        },
        {
          id: 'w2',
          from: { partId: 'ldr', pinId: '2' },
          to: { partId: 'r1', pinId: 'lead1' },
          color: '#4f9cf9',
          waypoints: [],
        },
        {
          id: 'w3',
          from: { partId: 'r1', pinId: 'lead2' },
          to: { partId: 'led', pinId: 'anode' },
          color: '#4f9cf9',
          waypoints: [],
        },
        {
          id: 'w4',
          from: { partId: 'led', pinId: 'cathode' },
          to: { partId: 'ps', pinId: 'minus' },
          color: '#4f9cf9',
          waypoints: [],
        },
      ],
    })
    const simulation = new ArduinoSimulation(SIMULATION_HEX, document)
    simulation.readInputs = () => ({ sensorLevels: new Map([['ldr', level]]) })

    const dark = simulation.frame().ledBrightness.get('led') ?? 0
    level = 1
    const bright = simulation.frame().ledBrightness.get('led') ?? 0
    expect(dark).toBeLessThan(0.01)
    expect(bright).toBeGreaterThan(0.1)
  })
})
