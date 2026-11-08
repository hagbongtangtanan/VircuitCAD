import type { Netlist } from '@vircuitcad/core';

export const GROUND_NODE = 0;

export function buildNodeMap(netlist: Netlist): Map<string, number> {
  const ground = netlist.nets.find((net) => net.isGround);
  const others = netlist.nets
    .filter((net) => net !== ground)
    .map((net) => net.name)
    .sort();

  const map = new Map<string, number>();
  if (ground) map.set(ground.name, GROUND_NODE);
  others.forEach((name, index) => map.set(name, index + 1));
  return map;
}
