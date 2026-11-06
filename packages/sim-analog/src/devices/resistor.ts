import type { Device } from '../device';

export function createResistor(
  name: string,
  nodeA: number,
  nodeB: number,
  resistance: number,
): Device {
  const conductance = resistance > 0 ? 1 / resistance : 1e12;
  return {
    name,
    nodes: [nodeA, nodeB],
    stamp: (ctx) => ctx.addConductance(nodeA, nodeB, conductance),
  };
}
