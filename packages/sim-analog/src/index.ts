export { LuDecomposition, SingularMatrixError } from './linalg';
export { MnaSystem } from './mna';
export { GROUND_NODE, buildNodeMap } from './node-map';
export { DEFAULT_GMIN, createMnaContext, setupDevices, stampDevices } from './context';
export type { Device, MnaContext } from './device';
export { createResistor } from './devices/resistor';
export { createVoltageSource } from './devices/voltage-source';
export { createCurrentSource } from './devices/current-source';
export { createSwitch, type SwitchDevice, type SwitchOptions } from './devices/switch';
export {
  solveOperatingPoint,
  type OperatingPointResult,
  type SolverOptions,
} from './solver';
export {
  createDiode,
  createLed,
  createZener,
  pnjlim,
  type DiodeDevice,
  type DiodeOptions,
} from './devices/nonlinear';
export { createCapacitor, createInductor, type ReactiveDevice } from './devices/reactive';
export type { IntegrationMethod } from './integration';
export {
  runTransient,
  type ReactiveLike,
  type TransientOptions,
  type TransientSample,
} from './transient';

export const packageName = '@vircuitcad/sim-analog';
