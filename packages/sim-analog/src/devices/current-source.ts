import type { Device } from '../device';

export function createCurrentSource(
  name: string,
  from: number,
  to: number,
  current: number,
): Device {
  return {
    name,
    nodes: [from, to],
    stamp: (ctx) => ctx.addCurrent(from, to, current),
  };
}
