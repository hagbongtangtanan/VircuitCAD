import { setupDevices } from '../src/context';
import { createCapacitor } from '../src/devices/reactive';
import { createResistor } from '../src/devices/resistor';
import { createVoltageSource } from '../src/devices/voltage-source';
import { MnaSystem } from '../src/mna';
import { runTransient } from '../src/transient';
import type { ReactiveLike } from '../src/transient';

const sections = 20;
const devices: ReactiveLike[] = [createVoltageSource('v1', 1, 0, 1, 0)];
for (let index = 1; index <= sections; index += 1) {
  devices.push(createResistor(`r${index}`, index, index + 1, 1e3));
  devices.push(createCapacitor(`c${index}`, index + 1, 0, 1e-9));
}

const system = new MnaSystem(sections + 1);
setupDevices(system, devices);

const dt = 1e-8;
const tstop = dt * 5000;
const start = Date.now();
const samples = runTransient(system, devices, { tstop, dt, method: 'be', adaptive: false });
const elapsed = (Date.now() - start) / 1000;
const steps = samples.length - 1;

console.log(
  `nodes=${system.nodeCount} steps=${steps} time=${elapsed.toFixed(3)}s -> ${Math.round(steps / elapsed)} steps/sec`,
);
