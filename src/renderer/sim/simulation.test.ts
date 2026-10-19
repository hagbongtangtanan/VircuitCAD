import { describe, expect, it } from 'vitest'
import { circuitDocumentSchema, type CircuitDocument } from '../../shared/circuit'
import { SIMULATION_HEX } from './fixtures'
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

  it('delivers Serial output to the byte callback', () => {
    const bytes: number[] = []
    const simulation = new ArduinoSimulation(SIMULATION_HEX, blinkCircuit())
    simulation.onSerialByte = (byte) => bytes.push(byte)
    simulation.runForCycles(CLOCK_HZ / 20)

    expect(String.fromCharCode(...bytes)).toContain('hello sim\r\n')
  })
})
