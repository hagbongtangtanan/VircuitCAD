import { McuCpu, type PortName } from './mcu';

export type TraceChange = { cycles: number; port: PortName; value: number };

/** Runs a program deterministically and records port-register changes with cycle stamps. */
export function recordTrace(
  hex: string,
  micros: number,
  ports: PortName[] = ['B', 'C', 'D'],
): TraceChange[] {
  const mcu = new McuCpu(hex);
  const changes: TraceChange[] = [];
  for (const port of ports) {
    mcu.onPortChange(port, (value) => {
      changes.push({ cycles: mcu.cycles, port, value });
    });
  }
  mcu.runMicros(micros);
  return changes;
}
