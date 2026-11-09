import { extractNetlist, type Circuit, type Netlist, type PartRegistry } from '@vircuitcad/core';

import { setupDevices } from './context';
import type { Device } from './device';
import { createLed, createDiode } from './devices/nonlinear';
import { createResistor } from './devices/resistor';
import { createVoltageSource } from './devices/voltage-source';
import { createSwitch } from './devices/switch';
import { MnaSystem } from './mna';
import { buildNodeMap } from './node-map';
import { ldrResistance, ntcResistance, potentiometerResistances } from './sensors';
import { solveOperatingPoint, type OperatingPointResult } from './solver';

export type Simulation = {
  system: MnaSystem;
  devices: Device[];
  nodeMap: Map<string, number>;
  netlist: Netlist;
  nodeOf: (partId: string, pinId: string) => number;
  deviceByName: (name: string) => Device | undefined;
};

function numericParam(
  params: Record<string, unknown>,
  manifest: { params: { id: string; default: unknown }[] },
  key: string,
  fallback: number,
): number {
  const value = params[key] ?? manifest.params.find((param) => param.id === key)?.default;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function booleanParam(params: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = params[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function buildSimulation(circuit: Circuit, registry: PartRegistry): Simulation {
  const netlist = extractNetlist(circuit, registry);
  const nodeMap = buildNodeMap(netlist);

  const pinNet = new Map<string, string>();
  for (const net of netlist.nets) {
    for (const pin of net.pins) pinNet.set(`${pin.partId}:${pin.pinId}`, net.name);
  }

  const nodeOf = (partId: string, pinId: string): number => {
    const netName = pinNet.get(`${partId}:${pinId}`);
    if (netName === undefined) return 0;
    return nodeMap.get(netName) ?? 0;
  };

  const devices: Device[] = [];
  for (const part of circuit.parts) {
    const manifest = registry.get(part.partId);
    if (!manifest) continue;
    const params = part.params as Record<string, unknown>;

    switch (manifest.simModel) {
      case 'resistor':
        devices.push(
          createResistor(
            part.id,
            nodeOf(part.id, 'a'),
            nodeOf(part.id, 'b'),
            numericParam(params, manifest, 'resistance', 220),
          ),
        );
        break;
      case 'led':
        devices.push(
          createLed(
            part.id,
            String(params.color ?? 'red'),
            nodeOf(part.id, 'anode'),
            nodeOf(part.id, 'cathode'),
          ),
        );
        break;
      case 'battery':
      case 'battery-pack':
        devices.push(
          createVoltageSource(
            part.id,
            nodeOf(part.id, 'positive'),
            nodeOf(part.id, 'negative'),
            numericParam(params, manifest, 'voltage', manifest.simModel === 'battery' ? 9 : 4.5),
          ),
        );
        break;
      case 'switch':
        devices.push(
          createSwitch(part.id, nodeOf(part.id, 'a'), nodeOf(part.id, 'b'), {
            closed: booleanParam(params, 'closed', false),
          }),
        );
        break;
      case 'pushbutton':
        devices.push(
          createSwitch(part.id, nodeOf(part.id, 'a'), nodeOf(part.id, 'b'), {
            closed: booleanParam(params, 'pressed', false),
          }),
        );
        break;
      case 'slide-switch':
        devices.push(
          createSwitch(part.id, nodeOf(part.id, 'a'), nodeOf(part.id, 'b'), {
            closed: booleanParam(params, 'closed', true),
          }),
        );
        break;
      case 'inductor':
        devices.push(
          createResistor(part.id, nodeOf(part.id, 'a'), nodeOf(part.id, 'b'), 1e-3),
        );
        break;
      case 'capacitor':
        // open in DC operating point
        break;
      case 'power-supply':
        devices.push(
          createVoltageSource(
            part.id,
            nodeOf(part.id, 'positive'),
            nodeOf(part.id, 'negative'),
            numericParam(params, manifest, 'voltage', 5),
          ),
        );
        break;
      case 'multimeter':
        if (String(params.mode ?? 'V') === 'A') {
          devices.push(
            createVoltageSource(
              part.id,
              nodeOf(part.id, 'probe+'),
              nodeOf(part.id, 'probe-'),
              0,
              1e-3,
            ),
          );
        }
        break;
      case 'diode':
        devices.push(createDiode(part.id, nodeOf(part.id, 'anode'), nodeOf(part.id, 'cathode')));
        break;
      case 'ldr':
        devices.push(
          createResistor(
            part.id,
            nodeOf(part.id, 'a'),
            nodeOf(part.id, 'b'),
            ldrResistance(numericParam(params, manifest, 'lux', 500)),
          ),
        );
        break;
      case 'ntc':
        devices.push(
          createResistor(
            part.id,
            nodeOf(part.id, 'a'),
            nodeOf(part.id, 'b'),
            ntcResistance(numericParam(params, manifest, 'temperature', 25)),
          ),
        );
        break;
      case 'potentiometer': {
        const legs = potentiometerResistances(
          numericParam(params, manifest, 'resistance', 10_000),
          numericParam(params, manifest, 'position', 0.5),
        );
        const a = nodeOf(part.id, 'a');
        const wiper = nodeOf(part.id, 'wiper');
        const b = nodeOf(part.id, 'b');
        devices.push(createResistor(`${part.id}:low`, a, wiper, Math.max(legs.low, 0.01)));
        devices.push(createResistor(`${part.id}:high`, wiper, b, Math.max(legs.high, 0.01)));
        break;
      }
      case 'seven-segment': {
        const common = String(params.common ?? 'cathode');
        const comNode = nodeOf(part.id, 'com');
        for (const segment of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp']) {
          const segNode = nodeOf(part.id, segment);
          if (common === 'cathode') {
            devices.push(createLed(`${part.id}:${segment}`, 'red', segNode, comNode));
          } else {
            devices.push(createLed(`${part.id}:${segment}`, 'red', comNode, segNode));
          }
        }
        break;
      }
      case 'arduino-uno': {
        const gnd = nodeOf(part.id, 'GND');
        devices.push(createVoltageSource(`${part.id}:5V`, nodeOf(part.id, '5V'), gnd, 5));
        devices.push(createVoltageSource(`${part.id}:3V3`, nodeOf(part.id, '3V3'), gnd, 3.3));
        break;
      }
      default:
        break;
    }
  }

  const nodeCount = Math.max(0, ...[...nodeMap.values()]);
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  const byName = new Map(devices.map((device) => [device.name, device]));

  return {
    system,
    devices,
    nodeMap,
    netlist,
    nodeOf,
    deviceByName: (name) => byName.get(name),
  };
}

export type MeterReading = {
  partId: string;
  mode: string;
  value: number | null;
  unit: string;
};

/** Reads multimeter values from a solved operating point (Ω is power-off only, returned as null). */
export function readMeters(
  circuit: Circuit,
  registry: PartRegistry,
  simulation: Simulation,
  solution: Float64Array,
): MeterReading[] {
  const readings: MeterReading[] = [];
  for (const part of circuit.parts) {
    const manifest = registry.get(part.partId);
    if (!manifest || manifest.simModel !== 'multimeter') continue;
    const mode = String(part.params.mode ?? 'V');

    if (mode === 'V') {
      const value =
        simulation.system.nodeVoltage(solution, simulation.nodeOf(part.id, 'probe+')) -
        simulation.system.nodeVoltage(solution, simulation.nodeOf(part.id, 'probe-'));
      readings.push({ partId: part.id, mode, value, unit: 'V' });
    } else if (mode === 'A') {
      const device = simulation.deviceByName(part.id) as
        | { readCurrent?: (current: Float64Array) => number }
        | undefined;
      readings.push({ partId: part.id, mode, value: device?.readCurrent?.(solution) ?? null, unit: 'A' });
    } else {
      readings.push({ partId: part.id, mode, value: null, unit: 'Ω' });
    }
  }
  return readings;
}

/** Solves the operating point with source stepping (robust for tiny saturation currents). */
export function solveSimulation(simulation: Simulation): OperatingPointResult {
  return solveOperatingPoint(simulation.system, simulation.devices, undefined, {
    setSourceScale: (scale) => {
      for (const device of simulation.devices) {
        (device as { setScale?: (value: number) => void }).setScale?.(scale);
      }
    },
  });
}
