import { extractNetlist, type Circuit, type Netlist, type PartRegistry } from '@vircuitcad/core';

import { setupDevices } from './context';
import type { Device } from './device';
import { createLed, createDiode } from './devices/nonlinear';
import { createResistor } from './devices/resistor';
import { createVoltageSource } from './devices/voltage-source';
import { createSwitch } from './devices/switch';
import { MnaSystem } from './mna';
import { buildNodeMap } from './node-map';
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
        devices.push(
          createVoltageSource(
            part.id,
            nodeOf(part.id, 'positive'),
            nodeOf(part.id, 'negative'),
            numericParam(params, manifest, 'voltage', 9),
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
      case 'diode':
        devices.push(createDiode(part.id, nodeOf(part.id, 'anode'), nodeOf(part.id, 'cathode')));
        break;
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
