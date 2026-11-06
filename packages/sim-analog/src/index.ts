export { LuDecomposition, SingularMatrixError } from './linalg';
export { MnaSystem } from './mna';
export { GROUND_NODE, buildNodeMap } from './node-map';
export { DEFAULT_GMIN, createMnaContext, setupDevices, stampDevices } from './context';
export type { Device, MnaContext } from './device';
export { createResistor } from './devices/resistor';
export { createVoltageSource } from './devices/voltage-source';
export { createCurrentSource } from './devices/current-source';
export { createSwitch, type SwitchDevice, type SwitchOptions } from './devices/switch';

export const packageName = '@vircuitcad/sim-analog';
