import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  createEmptyCircuit,
  createPartInstance,
  createWire,
  serializeCircuit,
  type Circuit,
  type ParamValue,
} from '../../packages/core/src/index.ts';

type PartSpec = {
  id: string;
  partId: string;
  x: number;
  y: number;
  params?: Record<string, ParamValue>;
};
type WireSpec = [partA: string, pinA: string, partB: string, pinB: string];
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

type Example = {
  file: string;
  title: string;
  category: string;
  difficulty: Difficulty;
  description: string;
  parts: PartSpec[];
  wires: WireSpec[];
};

function circuitOf(example: Example): Circuit {
  const circuit = createEmptyCircuit({ name: example.title });
  for (const part of example.parts) {
    circuit.parts.push(
      createPartInstance(part.partId, {
        id: part.id,
        position: { x: part.x, y: part.y },
        ...(part.params ? { params: part.params } : {}),
      }),
    );
  }
  for (const [partA, pinA, partB, pinB] of example.wires) {
    circuit.wires.push(
      createWire({ kind: 'pin', partId: partA, pinId: pinA }, { kind: 'pin', partId: partB, pinId: pinB }),
    );
  }
  return circuit;
}

const EXAMPLES: Example[] = [
  {
    file: 'led-resistor.vcad',
    title: 'LED + resistor',
    category: 'Basics',
    difficulty: 'beginner',
    description: 'A battery lights an LED through a current-limiting resistor.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 9 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 220 } },
      { id: 'd1', partId: 'led', x: 0, y: 24, params: { color: 'red', forwardVoltage: 2 } },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'd1', 'anode'],
      ['d1', 'cathode', 'bt1', 'negative'],
    ],
  },
  {
    file: 'voltage-divider.vcad',
    title: 'Voltage divider',
    category: 'Basics',
    difficulty: 'beginner',
    description: 'Two equal resistors halve the supply; measure the midpoint.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 9 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 1000 } },
      { id: 'r2', partId: 'resistor', x: 0, y: 24, params: { resistance: 1000 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 26, params: { mode: 'V' } },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'r2', 'a'],
      ['r1', 'b', 'm1', 'probe+'],
      ['r2', 'b', 'bt1', 'negative'],
      ['m1', 'probe-', 'r2', 'b'],
    ],
  },
  {
    file: 'switch-led.vcad',
    title: 'Switch + LED',
    category: 'Basics',
    difficulty: 'beginner',
    description: 'A slide switch controls an LED.',
    parts: [
      { id: 'pack1', partId: 'battery-pack', x: 0, y: 20, params: { voltage: 4.5 } },
      { id: 'sw1', partId: 'slide-switch', x: 0, y: 22, params: { closed: true } },
      { id: 'r1', partId: 'resistor', x: 0, y: 24, params: { resistance: 100 } },
      { id: 'd1', partId: 'led', x: 0, y: 26, params: { color: 'green' } },
    ],
    wires: [
      ['pack1', 'positive', 'sw1', 'a'],
      ['sw1', 'b', 'r1', 'a'],
      ['r1', 'b', 'd1', 'anode'],
      ['d1', 'cathode', 'pack1', 'negative'],
    ],
  },
  {
    file: 'series-resistors.vcad',
    title: 'Series resistors',
    category: 'Basics',
    difficulty: 'beginner',
    description: 'Measure the drop across one of two series resistors.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 9 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 220 } },
      { id: 'r2', partId: 'resistor', x: 0, y: 24, params: { resistance: 220 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 26, params: { mode: 'V' } },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'r2', 'a'],
      ['r2', 'b', 'bt1', 'negative'],
      ['m1', 'probe+', 'r2', 'a'],
      ['m1', 'probe-', 'r2', 'b'],
    ],
  },
  {
    file: 'parallel-leds.vcad',
    title: 'Parallel LEDs',
    category: 'Basics',
    difficulty: 'beginner',
    description: 'Two LEDs in parallel branches, each with its own resistor.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 9 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 220 } },
      { id: 'd1', partId: 'led', x: 2, y: 22, params: { color: 'red' } },
      { id: 'r2', partId: 'resistor', x: 0, y: 24, params: { resistance: 220 } },
      { id: 'd2', partId: 'led', x: 2, y: 24, params: { color: 'blue' } },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'd1', 'anode'],
      ['d1', 'cathode', 'bt1', 'negative'],
      ['bt1', 'positive', 'r2', 'a'],
      ['r2', 'b', 'd2', 'anode'],
      ['d2', 'cathode', 'bt1', 'negative'],
    ],
  },
  {
    file: 'led-bar.vcad',
    title: 'LED bar',
    category: 'Basics',
    difficulty: 'beginner',
    description: 'A five-segment bar graph driven from one rail.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 220 } },
      { id: 'bar1', partId: 'led-bar', x: 0, y: 24, params: {} },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'bar1', 's1'],
      ['r1', 'b', 'bar1', 's2'],
      ['r1', 'b', 'bar1', 's3'],
      ['r1', 'b', 'bar1', 's4'],
      ['r1', 'b', 'bar1', 's5'],
      ['bar1', 'com', 'bt1', 'negative'],
    ],
  },
  {
    file: 'rc-charge.vcad',
    title: 'RC charge',
    category: 'Analog',
    difficulty: 'beginner',
    description: 'A capacitor charges through a resistor with time constant RC.',
    parts: [
      { id: 'ps1', partId: 'power-supply', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 1000 } },
      { id: 'c1', partId: 'capacitor', x: 0, y: 24, params: { capacitance: 1e-6 } },
    ],
    wires: [
      ['ps1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'c1', 'a'],
      ['c1', 'b', 'ps1', 'negative'],
    ],
  },
  {
    file: 'rl-current.vcad',
    title: 'RL current',
    category: 'Analog',
    difficulty: 'intermediate',
    description: 'Current through an inductor settles as the field builds.',
    parts: [
      { id: 'ps1', partId: 'power-supply', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 100 } },
      { id: 'l1', partId: 'inductor', x: 0, y: 24, params: { inductance: 1e-3 } },
    ],
    wires: [
      ['ps1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'l1', 'a'],
      ['l1', 'b', 'ps1', 'negative'],
    ],
  },
  {
    file: 'ldr-divider.vcad',
    title: 'LDR light divider',
    category: 'Analog',
    difficulty: 'intermediate',
    description: 'An LDR and a fixed resistor form a light-dependent divider.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 10000 } },
      { id: 'ldr1', partId: 'ldr', x: 0, y: 24, params: { lux: 500 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 26, params: { mode: 'V' } },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'ldr1', 'a'],
      ['ldr1', 'b', 'bt1', 'negative'],
      ['m1', 'probe+', 'ldr1', 'a'],
      ['m1', 'probe-', 'ldr1', 'b'],
    ],
  },
  {
    file: 'potentiometer-divider.vcad',
    title: 'Potentiometer divider',
    category: 'Analog',
    difficulty: 'beginner',
    description: 'A potentiometer wiper sets an adjustable voltage.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'pot1', partId: 'potentiometer', x: 0, y: 22, params: { resistance: 10000, position: 0.5 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 24, params: { mode: 'V' } },
    ],
    wires: [
      ['bt1', 'positive', 'pot1', 'a'],
      ['pot1', 'b', 'bt1', 'negative'],
      ['m1', 'probe+', 'pot1', 'wiper'],
      ['m1', 'probe-', 'pot1', 'b'],
    ],
  },
  {
    file: 'ntc-divider.vcad',
    title: 'NTC thermistor divider',
    category: 'Analog',
    difficulty: 'intermediate',
    description: 'A thermistor and fixed resistor give a temperature-dependent voltage.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 10000 } },
      { id: 'ntc1', partId: 'ntc', x: 0, y: 24, params: { temperature: 25 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 26, params: { mode: 'V' } },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'ntc1', 'a'],
      ['ntc1', 'b', 'bt1', 'negative'],
      ['m1', 'probe+', 'ntc1', 'a'],
      ['m1', 'probe-', 'ntc1', 'b'],
    ],
  },
  {
    file: 'rc-discharge.vcad',
    title: 'RC with switch',
    category: 'Analog',
    difficulty: 'intermediate',
    description: 'A switched RC network charges the capacitor.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'sw1', partId: 'slide-switch', x: 0, y: 22, params: { closed: true } },
      { id: 'r1', partId: 'resistor', x: 0, y: 24, params: { resistance: 1000 } },
      { id: 'c1', partId: 'capacitor', x: 0, y: 26, params: { capacitance: 1e-6 } },
    ],
    wires: [
      ['bt1', 'positive', 'sw1', 'a'],
      ['sw1', 'b', 'r1', 'a'],
      ['r1', 'b', 'c1', 'a'],
      ['c1', 'b', 'bt1', 'negative'],
    ],
  },
  {
    file: 'seven-segment.vcad',
    title: '7-segment display',
    category: 'Digital',
    difficulty: 'intermediate',
    description: 'Light every segment of a 7-segment display.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 220 } },
      { id: 'seg1', partId: 'seven-segment', x: 0, y: 24, params: {} },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'seg1', 'a'],
      ['r1', 'b', 'seg1', 'b'],
      ['r1', 'b', 'seg1', 'c'],
      ['r1', 'b', 'seg1', 'd'],
      ['r1', 'b', 'seg1', 'e'],
      ['r1', 'b', 'seg1', 'f'],
      ['r1', 'b', 'seg1', 'g'],
      ['seg1', 'com', 'bt1', 'negative'],
    ],
  },
  {
    file: 'rgb-led.vcad',
    title: 'RGB LED',
    category: 'Digital',
    difficulty: 'intermediate',
    description: 'Drive all three colours of an RGB LED together.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 220 } },
      { id: 'rgb1', partId: 'rgb-led', x: 0, y: 24, params: {} },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'rgb1', 'r'],
      ['r1', 'b', 'rgb1', 'g'],
      ['r1', 'b', 'rgb1', 'b'],
      ['rgb1', 'com', 'bt1', 'negative'],
    ],
  },
  {
    file: 'pushbutton-led.vcad',
    title: 'Pushbutton + LED',
    category: 'Digital',
    difficulty: 'beginner',
    description: 'A pushbutton in series with a resistor and LED.',
    parts: [
      { id: 'pack1', partId: 'battery-pack', x: 0, y: 20, params: { voltage: 4.5 } },
      { id: 'sw1', partId: 'pushbutton', x: 0, y: 22, params: { pressed: true } },
      { id: 'r1', partId: 'resistor', x: 0, y: 24, params: { resistance: 220 } },
      { id: 'd1', partId: 'led', x: 0, y: 26, params: { color: 'red' } },
    ],
    wires: [
      ['pack1', 'positive', 'sw1', 'a'],
      ['sw1', 'b', 'r1', 'a'],
      ['r1', 'b', 'd1', 'anode'],
      ['d1', 'cathode', 'pack1', 'negative'],
    ],
  },
  {
    file: 'two-resistors-parallel.vcad',
    title: 'Parallel resistors',
    category: 'Basics',
    difficulty: 'beginner',
    description: 'Two equal resistors in parallel halve the resistance.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 9 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 1000 } },
      { id: 'r2', partId: 'resistor', x: 2, y: 22, params: { resistance: 1000 } },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'bt1', 'negative'],
      ['bt1', 'positive', 'r2', 'a'],
      ['r2', 'b', 'bt1', 'negative'],
    ],
  },
  {
    file: 'led-series-chain.vcad',
    title: 'LEDs in series',
    category: 'Digital',
    difficulty: 'intermediate',
    description: 'Two LEDs share one current-limiting resistor in series.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 9 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 220 } },
      { id: 'd1', partId: 'led', x: 0, y: 24, params: { color: 'red' } },
      { id: 'd2', partId: 'led', x: 0, y: 26, params: { color: 'green' } },
    ],
    wires: [
      ['bt1', 'positive', 'r1', 'a'],
      ['r1', 'b', 'd1', 'anode'],
      ['d1', 'cathode', 'd2', 'anode'],
      ['d2', 'cathode', 'bt1', 'negative'],
    ],
  },
  {
    file: 'ldr-light-meter.vcad',
    title: 'Light meter',
    category: 'Sensors',
    difficulty: 'beginner',
    description: 'Measure the voltage across an LDR.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'ldr1', partId: 'ldr', x: 0, y: 22, params: { lux: 500 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 24, params: { mode: 'V' } },
    ],
    wires: [
      ['bt1', 'positive', 'ldr1', 'a'],
      ['ldr1', 'b', 'bt1', 'negative'],
      ['m1', 'probe+', 'ldr1', 'a'],
      ['m1', 'probe-', 'ldr1', 'b'],
    ],
  },
  {
    file: 'ntc-thermometer.vcad',
    title: 'Thermometer',
    category: 'Sensors',
    difficulty: 'beginner',
    description: 'Measure the voltage across an NTC thermistor.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'ntc1', partId: 'ntc', x: 0, y: 22, params: { temperature: 25 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 24, params: { mode: 'V' } },
    ],
    wires: [
      ['bt1', 'positive', 'ntc1', 'a'],
      ['ntc1', 'b', 'bt1', 'negative'],
      ['m1', 'probe+', 'ntc1', 'a'],
      ['m1', 'probe-', 'ntc1', 'b'],
    ],
  },
  {
    file: 'trimmer-led.vcad',
    title: 'Trimmer dimmer',
    category: 'Sensors',
    difficulty: 'intermediate',
    description: 'A potentiometer wiper feeds an LED through a resistor.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'pot1', partId: 'potentiometer', x: 0, y: 22, params: { resistance: 10000, position: 0.75 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 24, params: { resistance: 220 } },
      { id: 'd1', partId: 'led', x: 0, y: 26, params: { color: 'red' } },
    ],
    wires: [
      ['bt1', 'positive', 'pot1', 'a'],
      ['pot1', 'b', 'bt1', 'negative'],
      ['pot1', 'wiper', 'r1', 'a'],
      ['r1', 'b', 'd1', 'anode'],
      ['d1', 'cathode', 'bt1', 'negative'],
    ],
  },
  {
    file: 'ldr-ntc-bridge.vcad',
    title: 'LDR / NTC bridge',
    category: 'Sensors',
    difficulty: 'advanced',
    description: 'A light sensor and thermistor in series with a meter.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'ldr1', partId: 'ldr', x: 0, y: 22, params: { lux: 500 } },
      { id: 'ntc1', partId: 'ntc', x: 0, y: 24, params: { temperature: 25 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 26, params: { mode: 'V' } },
    ],
    wires: [
      ['bt1', 'positive', 'ldr1', 'a'],
      ['ldr1', 'b', 'ntc1', 'a'],
      ['ntc1', 'b', 'bt1', 'negative'],
      ['m1', 'probe+', 'ntc1', 'a'],
      ['m1', 'probe-', 'ntc1', 'b'],
    ],
  },
  {
    file: 'light-led.vcad',
    title: 'Light-controlled LED',
    category: 'Sensors',
    difficulty: 'intermediate',
    description: 'An LDR in series dims an LED as light changes.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'ldr1', partId: 'ldr', x: 0, y: 22, params: { lux: 1000 } },
      { id: 'r1', partId: 'resistor', x: 0, y: 24, params: { resistance: 220 } },
      { id: 'd1', partId: 'led', x: 0, y: 26, params: { color: 'red' } },
    ],
    wires: [
      ['bt1', 'positive', 'ldr1', 'a'],
      ['ldr1', 'b', 'r1', 'a'],
      ['r1', 'b', 'd1', 'anode'],
      ['d1', 'cathode', 'bt1', 'negative'],
    ],
  },
  {
    file: 'ammeter-led.vcad',
    title: 'Ammeter',
    category: 'Instruments',
    difficulty: 'intermediate',
    description: 'Measure LED current with the multimeter in A mode.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 5 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 22, params: { mode: 'A' } },
      { id: 'r1', partId: 'resistor', x: 0, y: 24, params: { resistance: 220 } },
      { id: 'd1', partId: 'led', x: 0, y: 26, params: { color: 'red' } },
    ],
    wires: [
      ['bt1', 'positive', 'm1', 'probe+'],
      ['m1', 'probe-', 'r1', 'a'],
      ['r1', 'b', 'd1', 'anode'],
      ['d1', 'cathode', 'bt1', 'negative'],
    ],
  },
  {
    file: 'voltmeter-battery.vcad',
    title: 'Voltmeter',
    category: 'Instruments',
    difficulty: 'beginner',
    description: 'Read a battery voltage with the multimeter.',
    parts: [
      { id: 'bt1', partId: 'battery', x: 0, y: 20, params: { voltage: 9 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 22, params: { mode: 'V' } },
    ],
    wires: [
      ['bt1', 'positive', 'm1', 'probe+'],
      ['m1', 'probe-', 'bt1', 'negative'],
    ],
  },
  {
    file: 'ohmmeter-resistor.vcad',
    title: 'Ohmmeter',
    category: 'Instruments',
    difficulty: 'beginner',
    description: 'Measure a resistor with the multimeter (power off).',
    parts: [
      { id: 'm1', partId: 'multimeter', x: 0, y: 20, params: { mode: 'R' } },
      { id: 'r1', partId: 'resistor', x: 0, y: 22, params: { resistance: 470 } },
    ],
    wires: [
      ['m1', 'probe+', 'r1', 'a'],
      ['m1', 'probe-', 'r1', 'b'],
    ],
  },
  {
    file: 'arduino-led.vcad',
    title: 'Arduino LED',
    category: 'Arduino',
    difficulty: 'beginner',
    description: 'An LED on D13 with a current-limiting resistor.',
    parts: [
      { id: 'uno1', partId: 'arduino-uno', x: 0, y: 20, params: {} },
      { id: 'r1', partId: 'resistor', x: 0, y: 24, params: { resistance: 220 } },
      { id: 'd1', partId: 'led', x: 0, y: 26, params: { color: 'red' } },
    ],
    wires: [
      ['uno1', 'D13', 'r1', 'a'],
      ['r1', 'b', 'd1', 'anode'],
      ['d1', 'cathode', 'uno1', 'GND'],
    ],
  },
  {
    file: 'arduino-potentiometer.vcad',
    title: 'Arduino potentiometer',
    category: 'Arduino',
    difficulty: 'intermediate',
    description: 'A potentiometer on A0 read with the multimeter.',
    parts: [
      { id: 'uno1', partId: 'arduino-uno', x: 0, y: 20, params: {} },
      { id: 'pot1', partId: 'potentiometer', x: 0, y: 24, params: { resistance: 10000, position: 0.5 } },
      { id: 'm1', partId: 'multimeter', x: 0, y: 26, params: { mode: 'V' } },
    ],
    wires: [
      ['uno1', '5V', 'pot1', 'a'],
      ['pot1', 'b', 'uno1', 'GND'],
      ['pot1', 'wiper', 'm1', 'probe+'],
      ['m1', 'probe-', 'uno1', 'GND'],
    ],
  },
];

const dir = fileURLToPath(new URL('../../examples/', import.meta.url));
mkdirSync(dir, { recursive: true });

for (const example of EXAMPLES) {
  writeFileSync(`${dir}${example.file}`, serializeCircuit(circuitOf(example)));
}

const manifest = {
  examples: EXAMPLES.map((example) => ({
    id: example.file.replace(/\.vcad$/, ''),
    file: example.file,
    title: example.title,
    category: example.category,
    difficulty: example.difficulty,
    description: example.description,
  })),
};
writeFileSync(`${dir}manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`wrote ${EXAMPLES.length} examples + manifest to ${dir}`);
