import type { Circuit, PartRegistry } from '@vircuitcad/core';
import {
  buildSimulation,
  createDynamicPin,
  setupDevices,
  solveOperatingPoint,
  type Device,
  type DigitalPinState,
  type OperatingPointResult,
  type Simulation,
} from '@vircuitcad/sim-analog';
import { McuCpu, type PinMode, type PortName } from '@vircuitcad/sim-mcu';

const PIN_MAP: Record<string, { port: PortName; bit: number }> = {};
for (let index = 0; index < 8; index += 1) PIN_MAP[`D${index}`] = { port: 'D', bit: index };
for (let index = 0; index < 6; index += 1) PIN_MAP[`D${8 + index}`] = { port: 'B', bit: index };
for (let index = 0; index < 6; index += 1) PIN_MAP[`A${index}`] = { port: 'C', bit: index };

function toPinState(mode: PinMode): DigitalPinState {
  if (mode === 'high') return 'output-high';
  if (mode === 'low') return 'output-low';
  if (mode === 'input-pullup') return 'input-pullup';
  return 'input';
}

/** Couples an emulated ATmega328P to the analog circuit: pin states drive the solver. */
export class McuCircuit {
  private readonly simulation: Simulation;
  private readonly mcu: McuCpu;
  private readonly devices: Device[];

  constructor(circuit: Circuit, registry: PartRegistry, hex: string) {
    this.simulation = buildSimulation(circuit, registry);
    this.mcu = new McuCpu(hex);

    const dynamic: Device[] = [];
    for (const part of circuit.parts) {
      const manifest = registry.get(part.partId);
      if (!manifest || manifest.simModel !== 'arduino-uno') continue;
      const railNode = this.simulation.nodeOf(part.id, '5V');
      for (const [pinId, mapping] of Object.entries(PIN_MAP)) {
        const node = this.simulation.nodeOf(part.id, pinId);
        if (node === 0) continue;
        dynamic.push(
          createDynamicPin(
            `${part.id}:${pinId}`,
            node,
            () => toPinState(this.mcu.pinState(mapping.port, mapping.bit)),
            { railNode },
          ),
        );
      }
    }
    setupDevices(this.simulation.system, dynamic);
    this.devices = [...this.simulation.devices, ...dynamic];
  }

  get cycles(): number {
    return this.mcu.cycles;
  }

  runMicros(micros: number): OperatingPointResult {
    this.mcu.runMicros(micros);
    return solveOperatingPoint(this.simulation.system, this.devices);
  }

  ledCurrent(partId: string): number {
    const device = this.simulation.deviceByName(partId) as { current?: number } | undefined;
    return device?.current ?? 0;
  }

  onSerial(listener: (byte: number) => void): void {
    this.mcu.onSerial(listener);
  }
}
