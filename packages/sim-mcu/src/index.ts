export { HexParseError, parseIntelHex, type ProgramMemory } from './intel-hex';
export { CLOCK_HZ, McuCpu, type PinMode, type PortName } from './mcu';
export { Pacer, type PacerOptions, type PacerTick } from './pacer';
export { recordTrace, type TraceChange } from './trace';
export {
  McuCommandSchema,
  McuEventSchema,
  McuPortSchema,
  McuStateEventSchema,
  PinChangeEventSchema,
  SerialEventSchema,
  type McuCommand,
  type McuEvent,
  type McuPinChangeEvent,
  type McuPort,
  type McuSerialEvent,
  type McuStateEvent,
} from './protocol';

export const packageName = '@vircuitcad/sim-mcu';
