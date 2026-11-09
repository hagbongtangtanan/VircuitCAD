import type { Circuit, PartRegistry } from '@vircuitcad/core';

import type { Device } from './device';

export const LOGIC_VOLTAGE = 5;
export const PIN_RESISTANCE = 25;
export const PULLUP_RESISTANCE = 30_000;
export const ADC_REFERENCE = 5;
export const INPUT_LOW_THRESHOLD = 1.5;
export const INPUT_HIGH_THRESHOLD = 3.0;

export type DigitalPinState = 'output-high' | 'output-low' | 'input' | 'input-pullup';

/** AVR OUTPUT pin: Thevenin source (level through ~25 Ω). */
export type McuOutputDevice = Device & {
  high: boolean;
  setHigh(value: boolean): void;
};

export function createMcuOutput(
  name: string,
  node: number,
  high: boolean,
  options: { onResistance?: number; highLevel?: number } = {},
): McuOutputDevice {
  const resistance = options.onResistance ?? PIN_RESISTANCE;
  const level = options.highLevel ?? LOGIC_VOLTAGE;
  let internal = -1;
  let branch = -1;
  let state = high;

  return {
    name,
    kind: 'mcu-output',
    nodes: [node],
    setup: (system) => {
      internal = system.addNode();
      branch = system.reserveVoltageSource();
    },
    stamp: (ctx) => {
      ctx.addConductance(node, internal, 1 / resistance);
      ctx.stampVoltageSource(internal, 0, branch);
      ctx.addBranchResistance(branch, 1e-3);
      ctx.setVoltageSource(branch, state ? level : 0);
    },
    get high() {
      return state;
    },
    setHigh(value: boolean) {
      state = value;
    },
  };
}

/** AVR INPUT_PULLUP pin: a ~30 kΩ resistor to the rail. */
export function createPullup(
  name: string,
  node: number,
  railNode: number,
  resistance = PULLUP_RESISTANCE,
): Device {
  return {
    name,
    kind: 'mcu-pullup',
    nodes: [node, railNode],
    stamp: (ctx) => ctx.addConductance(node, railNode, 1 / resistance),
  };
}

/** hardware threshold with hysteresis (previous state decides which edge to use). */
export function digitalRead(
  voltage: number,
  previous: boolean,
  options: { low?: number; high?: number } = {},
): boolean {
  const low = options.low ?? INPUT_LOW_THRESHOLD;
  const high = options.high ?? INPUT_HIGH_THRESHOLD;
  return previous ? voltage > low : voltage > high;
}

/** 10-bit ADC sample of a node voltage, clamped to the reference. */
export function analogRead(voltage: number, reference = ADC_REFERENCE): number {
  const clamped = Math.max(0, Math.min(reference, voltage));
  return Math.round((clamped / reference) * 1023);
}

/** Quasi-static PWM output: the average of level × duty. */
export function pwmAverageVoltage(duty: number, level = LOGIC_VOLTAGE): number {
  return Math.max(0, Math.min(1, duty)) * level;
}

export type PwmOutputDevice = Device & { setDuty(duty: number): void };

/** PWM pin modelled as an averaged Thevenin source (quasi-static path). */
export function createPwmOutput(
  name: string,
  node: number,
  duty: number,
  options: { onResistance?: number; level?: number } = {},
): PwmOutputDevice {
  const resistance = options.onResistance ?? PIN_RESISTANCE;
  const level = options.level ?? LOGIC_VOLTAGE;
  let internal = -1;
  let branch = -1;
  let current = duty;

  return {
    name,
    kind: 'mcu-pwm',
    nodes: [node],
    setup: (system) => {
      internal = system.addNode();
      branch = system.reserveVoltageSource();
    },
    stamp: (ctx) => {
      ctx.addConductance(node, internal, 1 / resistance);
      ctx.stampVoltageSource(internal, 0, branch);
      ctx.addBranchResistance(branch, 1e-3);
      ctx.setVoltageSource(branch, pwmAverageVoltage(current, level));
    },
    setDuty(value: number) {
      current = value;
    },
  };
}

export type DynamicPinOptions = {
  railNode: number;
  onResistance?: number;
  pullupResistance?: number;
  highLevel?: number;
};

/** A pin whose electrical model follows the live MCU state (output/pull-up/Hi-Z). */
export function createDynamicPin(
  name: string,
  node: number,
  getState: () => DigitalPinState,
  options: DynamicPinOptions,
): Device {
  const resistance = options.onResistance ?? PIN_RESISTANCE;
  const pullup = options.pullupResistance ?? PULLUP_RESISTANCE;
  const level = options.highLevel ?? LOGIC_VOLTAGE;
  let internal = -1;
  let branch = -1;

  return {
    name,
    kind: 'mcu-pin',
    nodes: [node, options.railNode],
    setup: (system) => {
      internal = system.addNode();
      branch = system.reserveVoltageSource();
    },
    stamp: (ctx) => {
      const state = getState();
      // Always stamp the branch (a driving source) so the matrix stays non-singular;
      // the pin connects to it only when driving as an output.
      ctx.stampVoltageSource(internal, 0, branch);
      ctx.addBranchResistance(branch, 1e-3);
      if (state === 'output-high' || state === 'output-low') {
        ctx.setVoltageSource(branch, state === 'output-high' ? level : 0);
        ctx.addConductance(node, internal, 1 / resistance);
      } else {
        ctx.setVoltageSource(branch, 0);
        if (state === 'input-pullup') ctx.addConductance(node, options.railNode, 1 / pullup);
      }
    },
  };
}

/** True when the circuit has reactive parts, so PWM must run full transient. */
export function hasReactiveParts(circuit: Circuit, registry: PartRegistry): boolean {
  const reactive = new Set(['capacitor', 'inductor']);
  return circuit.parts.some((part) => {
    const manifest = registry.get(part.partId);
    return manifest ? reactive.has(manifest.simModel) : false;
  });
}
