import fc from 'fast-check';
import { expect, it } from 'vitest';

import {
  type BoardKind,
  type Circuit,
  type Endpoint,
  type Rotation,
  type Vec2,
  createPartInstance,
  createWire,
} from '../model/circuit';
import { createDefaultPartRegistry } from '../parts/catalog';
import { extractNetlist, type Netlist } from './netlist';

const registry = createDefaultPartRegistry();
const RUNS = 1000;

const PART_PINS: Record<string, string[]> = {
  resistor: ['a', 'b'],
  led: ['anode', 'cathode'],
  battery: ['positive', 'negative'],
};
const PART_IDS = Object.keys(PART_PINS);
const HOLES = ['a1', 'b1', 'c1', 'd1', 'e1', 'a4', 'c4', 'e4', 'c7', 'c9', 'c11'];

type PartSpec = { partId: string; position: Vec2; rotation: Rotation };

const rotationArb = fc.constantFrom<Rotation>(0, 90, 180, 270);
const partArb: fc.Arbitrary<PartSpec> = fc.record({
  partId: fc.constantFrom(...PART_IDS),
  position: fc.record({ x: fc.integer({ min: 0, max: 10 }), y: fc.constantFrom(3, 4, 5, 6, 7) }),
  rotation: rotationArb,
});
const partsArb = fc.array(partArb, { minLength: 1, maxLength: 3 });
const holeWireArb = fc.record({ from: fc.constantFrom(...HOLES), to: fc.constantFrom(...HOLES) });

function buildCircuit(
  board: BoardKind,
  parts: PartSpec[],
  wires: { from: string; to: string }[],
): Circuit {
  return {
    schemaVersion: 2,
    id: 'c',
    name: 'property',
    board: { id: 'b', kind: board },
    parts: parts.map((part, index) =>
      createPartInstance(part.partId, {
        id: `p${index}`,
        position: part.position,
        rotation: part.rotation,
      }),
    ),
    wires: wires.map((wire, index) =>
      createWire(
        { kind: 'hole', holeId: wire.from },
        { kind: 'hole', holeId: wire.to },
        { id: `w${index}` },
      ),
    ),
  };
}

const circuitArb = fc
  .record({
    board: fc.constantFrom<BoardKind>('full', 'half'),
    parts: partsArb,
    wires: fc.array(holeWireArb, { maxLength: 3 }),
  })
  .map(({ board, parts, wires }) => buildCircuit(board, parts, wires));

function grouping(netlist: Netlist, key: (partId: string) => string = (id) => id): string[][] {
  return netlist.nets
    .map((net) => net.pins.map((pin) => `${key(pin.partId)}:${pin.pinId}`).sort())
    .sort((a, b) => (a.join(',') < b.join(',') ? -1 : 1));
}

it('property: netlist is invariant to wire order', () => {
  fc.assert(
    fc.property(circuitArb, (circuit) => {
      const forward = extractNetlist(circuit, registry);
      const backward = extractNetlist({ ...circuit, wires: [...circuit.wires].reverse() }, registry);
      expect(backward.nets.map((net) => [net.name, net.pins])).toEqual(
        forward.nets.map((net) => [net.name, net.pins]),
      );
    }),
    { numRuns: RUNS },
  );
});

it('property: netlist is invariant to which hole of a strip is used', () => {
  fc.assert(
    fc.property(
      fc.constantFrom<BoardKind>('full', 'half'),
      partsArb,
      fc.integer({ min: 1, max: 11 }),
      (board, parts, column) => {
        const first = parts[0];
        if (!first) return;
        const pinId = PART_PINS[first.partId]?.[0] ?? 'a';

        const withHole = (row: string): Circuit => {
          const base = buildCircuit(board, parts, []);
          return {
            ...base,
            wires: [
              createWire(
                { kind: 'pin', partId: 'p0', pinId },
                { kind: 'hole', holeId: `${row}${column}` },
                { id: 'w0' },
              ),
            ],
          };
        };

        expect(grouping(extractNetlist(withHole('e'), registry))).toEqual(
          grouping(extractNetlist(withHole('a'), registry)),
        );
      },
    ),
    { numRuns: RUNS },
  );
});

it('property: pin-to-pin nets ignore part position and rotation', () => {
  const offBoard = (parts: PartSpec[], rotation: Rotation): PartSpec[] =>
    parts.map((part, index) => ({
      partId: part.partId,
      position: { x: part.position.x, y: 20 + index },
      rotation,
    }));

  fc.assert(
    fc.property(partsArb, rotationArb, rotationArb, fc.array(fc.nat(), { maxLength: 3 }), (parts, rotA, rotB, seeds) => {
      if (parts.length < 2) return;
      const wires = seeds.map((seed, index) => ({
        from: `p${seed % parts.length}`,
        to: `p${(seed + index + 1) % parts.length}`,
      }));

      const build = (rotation: Rotation): Circuit => {
        const base = buildCircuit('half', offBoard(parts, rotation), []);
        return {
          ...base,
          wires: wires.map((wire, index) =>
            createWire(
              { kind: 'pin', partId: wire.from, pinId: 'a' },
              { kind: 'pin', partId: wire.to, pinId: 'a' },
              { id: `w${index}` },
            ),
          ),
        };
      };

      expect(grouping(extractNetlist(build(rotB), registry))).toEqual(
        grouping(extractNetlist(build(rotA), registry)),
      );
    }),
    { numRuns: RUNS },
  );
});

it('property: regenerating ids preserves the grouping', () => {
  const remap = (circuit: Circuit): Circuit => {
    const remapEndpoint = (endpoint: Endpoint): Endpoint => {
      if (endpoint.kind !== 'pin') return endpoint;
      const partId = endpoint.partId;
      return { ...endpoint, partId: `q${circuit.parts.findIndex((part) => part.id === partId)}` };
    };
    return {
      ...circuit,
      id: 'c2',
      parts: circuit.parts.map((part, index) => ({ ...part, id: `q${index}` })),
      wires: circuit.wires.map((wire, index) => ({
        ...wire,
        id: `x${index}`,
        from: remapEndpoint(wire.from),
        to: remapEndpoint(wire.to),
      })),
    };
  };
  const indexOf = (partId: string): string => String(Number(partId.replace(/\D/g, '')));

  fc.assert(
    fc.property(circuitArb, (circuit) => {
      const original = extractNetlist(circuit, registry);
      const regenerated = extractNetlist(remap(circuit), registry);
      expect(grouping(regenerated, indexOf)).toEqual(grouping(original, indexOf));
    }),
    { numRuns: RUNS },
  );
});

it('property: nets partition every pin and extraction is idempotent', () => {
  fc.assert(
    fc.property(circuitArb, (circuit) => {
      const netlist = extractNetlist(circuit, registry);
      const seen = new Set<string>();
      let pinCount = 0;
      for (const net of netlist.nets) {
        for (const pin of net.pins) {
          const key = `${pin.partId}:${pin.pinId}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
          pinCount += 1;
        }
      }

      const expected = circuit.parts.reduce(
        (total, part) => total + (PART_PINS[part.partId]?.length ?? 0),
        0,
      );
      expect(pinCount).toBe(expected);

      expect(extractNetlist(circuit, registry)).toEqual(netlist);
    }),
    { numRuns: RUNS },
  );
});
