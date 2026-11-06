import { generateBoardGeometry, type BoardGeometry } from '../board/geometry';
import { rotateGridVector, type Circuit, type Endpoint, type PartInstance, type Vec2 } from '../model/circuit';
import type { Pin } from '../parts/manifest';
import type { PartRegistry } from '../parts/registry';

export type TerminalRef = { partId: string; pinId: string };
export type Net = {
  name: string;
  isGround: boolean;
  pins: TerminalRef[];
  holes: string[];
};
export type Netlist = {
  nets: Net[];
  floatingPins: TerminalRef[];
};

class UnionFind {
  private readonly parent = new Map<string, string>();

  find(item: string): string {
    const parent = this.parent.get(item);
    if (parent === undefined) {
      this.parent.set(item, item);
      return item;
    }
    if (parent === item) return item;
    const root = this.find(parent);
    this.parent.set(item, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

function absolutePinPosition(part: PartInstance, pin: Pin): Vec2 {
  const rotated = rotateGridVector(pin.position, part.rotation);
  return { x: part.position.x + rotated.x, y: part.position.y + rotated.y };
}

function pinNode(ref: TerminalRef): string {
  return `pin:${ref.partId}:${ref.pinId}`;
}

function holeNode(id: string): string {
  return `hole:${id}`;
}

function endpointNode(endpoint: Endpoint): string {
  return endpoint.kind === 'pin'
    ? pinNode({ partId: endpoint.partId, pinId: endpoint.pinId })
    : holeNode(endpoint.holeId);
}

function compareTerminals(a: TerminalRef, b: TerminalRef): number {
  if (a.partId !== b.partId) return a.partId < b.partId ? -1 : 1;
  if (a.pinId !== b.pinId) return a.pinId < b.pinId ? -1 : 1;
  return 0;
}

export function extractNetlist(
  circuit: Circuit,
  registry: PartRegistry,
  geometry: BoardGeometry = generateBoardGeometry(circuit.board.kind),
): Netlist {
  const uf = new UnionFind();
  const pinRefs = new Map<string, TerminalRef>();
  const pinRoles = new Map<string, Pin['role']>();

  for (const strip of geometry.strips) {
    const [first, ...rest] = strip.holes;
    if (first === undefined) continue;
    uf.find(holeNode(first));
    for (const hole of rest) uf.union(holeNode(first), holeNode(hole));
  }
  for (const hole of geometry.holes) uf.find(holeNode(hole.id));

  for (const part of circuit.parts) {
    const manifest = registry.get(part.partId);
    if (!manifest) throw new Error(`unknown part "${part.partId}"`);
    for (const pin of manifest.pins) {
      const ref: TerminalRef = { partId: part.id, pinId: pin.id };
      const node = pinNode(ref);
      pinRefs.set(node, ref);
      pinRoles.set(node, pin.role);
      uf.find(node);
      const position = absolutePinPosition(part, pin);
      const hole = geometry.holeByPosition(position.x, position.y);
      if (hole) uf.union(node, holeNode(hole.id));
    }
  }

  for (const wire of circuit.wires) {
    uf.union(endpointNode(wire.from), endpointNode(wire.to));
  }

  const groups = new Map<string, { pins: TerminalRef[]; holes: Set<string> }>();
  const groupFor = (root: string) => {
    let group = groups.get(root);
    if (!group) {
      group = { pins: [], holes: new Set() };
      groups.set(root, group);
    }
    return group;
  };

  for (const hole of geometry.holes) groupFor(uf.find(holeNode(hole.id))).holes.add(hole.id);
  for (const [node, ref] of pinRefs) groupFor(uf.find(node)).pins.push(ref);

  const nets: Net[] = [];
  for (const group of groups.values()) {
    if (group.pins.length === 0) continue;
    const pins = [...group.pins].sort(compareTerminals);
    const isGround = pins.some((pin) => pinRoles.get(pinNode(pin)) === 'ground');
    nets.push({ name: '', isGround, pins, holes: [...group.holes].sort() });
  }

  const canonical = (net: Net): string =>
    `${net.pins.map((pin) => `${pin.partId}:${pin.pinId}`).join(',')}|${net.holes.join(',')}`;
  nets.sort((a, b) => {
    const keyA = canonical(a);
    const keyB = canonical(b);
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });

  let counter = 0;
  for (const net of nets) {
    net.name = net.isGround ? 'GND' : `N${(counter += 1)}`;
  }

  const floatingPins = nets
    .filter((net) => net.pins.length === 1)
    .flatMap((net) => net.pins)
    .sort(compareTerminals);

  return { nets, floatingPins };
}
