import {
  createDefaultPartRegistry,
  createEmptyCircuit,
  createPartInstance,
} from '@vircuitcad/core';
import { expect, it } from 'vitest';

import { setupDevices, stampDevices } from './context';
import type { Device } from './device';
import {
  analogRead,
  createMcuOutput,
  createPwmOutput,
  createPullup,
  digitalRead,
  hasReactiveParts,
  pwmAverageVoltage,
} from './mcu-bridge';
import { createResistor } from './devices/resistor';
import { createSwitch } from './devices/switch';
import { createVoltageSource } from './devices/voltage-source';
import { MnaSystem } from './mna';

function solve(nodeCount: number, devices: Device[]) {
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  stampDevices(system, devices);
  const solution = system.solve();
  return { system, solution };
}

it('applies hysteresis on digital inputs', () => {
  expect(digitalRead(2.0, false)).toBe(false); // must exceed high to rise
  expect(digitalRead(2.0, true)).toBe(true); // stays high above low
  expect(digitalRead(1.0, true)).toBe(false);
  expect(digitalRead(4.0, false)).toBe(true);
});

it('scales analog inputs to 10 bits', () => {
  expect(analogRead(0)).toBe(0);
  expect(analogRead(5)).toBe(1023);
  expect(analogRead(2.5)).toBe(512);
  expect(analogRead(9)).toBe(1023);
});

it('drives an output pin through the Thevenin resistance', () => {
  // output-high (5 V, 25 Ω) loaded by 975 Ω to ground -> 5 * 975/1000 = 4.875 V
  const out = createMcuOutput('d13', 1, true);
  const { system, solution } = solve(1, [out, createResistor('load', 1, 0, 975)]);
  expect(system.nodeVoltage(solution, 1)).toBeCloseTo(4.875, 3);
});

it('pulls a floating input high, and low when the button shorts it to ground', () => {
  // 5 V rail (node1) -> pullup 30k -> node2 ; button node2 -> ground
  const open = solve(2, [
    createVoltageSource('v5', 1, 0, 5, 0),
    createPullup('pull', 2, 1),
  ]);
  expect(open.system.nodeVoltage(open.solution, 2)).toBeCloseTo(5, 3);

  const pressed = solve(2, [
    createVoltageSource('v5', 1, 0, 5, 0),
    createPullup('pull', 2, 1),
    createSwitch('btn', 2, 0, { closed: true, onResistance: 0.01 }),
  ]);
  expect(pressed.system.nodeVoltage(pressed.solution, 2)).toBeLessThan(0.01);
});

it('averages a PWM duty into a voltage', () => {
  expect(pwmAverageVoltage(0)).toBe(0);
  expect(pwmAverageVoltage(0.5)).toBe(2.5);
  expect(pwmAverageVoltage(1)).toBe(5);
  expect(pwmAverageVoltage(2)).toBe(5);
});

it('drives a PWM pin as an averaged Thevenin source', () => {
  const pwm = createPwmOutput('d9', 1, 0.5);
  const { system, solution } = solve(1, [pwm, createResistor('load', 1, 0, 975)]);
  // 2.5 V through 25 Ω into 975 Ω -> 2.5 * 975/1000
  expect(system.nodeVoltage(solution, 1)).toBeCloseTo(2.4375, 3);
});

it('detects reactive parts for the transient PWM path', () => {
  const registry = createDefaultPartRegistry();
  const resistive = createEmptyCircuit();
  resistive.parts.push(createPartInstance('resistor', { id: 'r1' }));
  expect(hasReactiveParts(resistive, registry)).toBe(false);

  const reactive = createEmptyCircuit();
  reactive.parts.push(createPartInstance('capacitor', { id: 'c1' }));
  expect(hasReactiveParts(reactive, registry)).toBe(true);
});

it('reads a divider into an analog input', () => {
  const { system, solution } = solve(2, [
    createVoltageSource('v5', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 10_000),
    createResistor('r2', 2, 0, 10_000),
  ]);
  expect(Math.abs(analogRead(system.nodeVoltage(solution, 2)) - 512)).toBeLessThanOrEqual(1);
});
