export { LuDecomposition, SingularMatrixError } from './linalg';
export { ldrResistance, ntcResistance, potentiometerResistances } from './sensors';
export { astable555, monostable555, type AstableTiming } from './timer555';
export {
  sampleWaveform,
  type FunctionGenOptions,
  type Waveform,
} from './function-gen';
export { servoAngle, servoPulse, type ServoOptions } from './servo';
export {
  hcSr04Distance,
  hcSr04EchoMicros,
  tmp36Temperature,
  tmp36Voltage,
} from './sensors2';
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
  createBjt,
  createMosfet,
  type BjtOptions,
  type MosfetOptions,
} from './devices/semiconductors';
export { createRelay, type RelayDevice, type RelayOptions } from './devices/relay';
export { createOpAmp, type OpAmpOptions } from './devices/opamp';
export {
  createDiode,
  createLed,
  createSchottky,
  createZener,
  pnjlim,
  type DiodeDevice,
  type DiodeOptions,
} from './devices/nonlinear';
export { createCapacitor, createInductor, type ReactiveDevice } from './devices/reactive';
export { SimError, type SimErrorCode, type SimErrorRef } from './errors';
export { assertHasGround, countVoltageSources, findFloatingNodes, solveDcOrThrow } from './diagnostics';
export type { IntegrationMethod } from './integration';
export {
  runTransient,
  type ReactiveLike,
  type TransientOptions,
  type TransientSample,
} from './transient';

export {
  buildSimulation,
  readMeters,
  solveSimulation,
  type MeterReading,
  type Simulation,
} from './bridge';
export {
  LedCurrentSchema,
  SimErrorEventSchema,
  SimStateSchema,
  SnapshotSchema,
  StatusSchema,
  WorkerCommandSchema,
  WorkerEventSchema,
  type SimErrorEvent,
  type SimSnapshot,
  type SimState,
  type SimStatus,
  type WorkerCommand,
  type WorkerEvent,
} from './worker/protocol';
export {
  ADC_REFERENCE,
  INPUT_HIGH_THRESHOLD,
  INPUT_LOW_THRESHOLD,
  LOGIC_VOLTAGE,
  PIN_RESISTANCE,
  PULLUP_RESISTANCE,
  analogRead,
  createDynamicPin,
  createMcuOutput,
  createPullup,
  createPwmOutput,
  digitalRead,
  hasReactiveParts,
  pwmAverageVoltage,
  type DigitalPinState,
  type DynamicPinOptions,
  type McuOutputDevice,
  type PwmOutputDevice,
} from './mcu-bridge';

export const packageName = '@vircuitcad/sim-analog';
