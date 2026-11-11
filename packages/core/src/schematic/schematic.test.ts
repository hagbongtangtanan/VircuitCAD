import { expect, it } from 'vitest';

import { extractNetlist } from '../board/netlist';
import { createEmptyCircuit, createPartInstance, createWire } from '../model/circuit';
import { createDefaultPartRegistry } from '../parts/catalog';
import { layoutSchematic, schematicToSvg } from './schematic';

function seriesCircuit() {
  const circuit = createEmptyCircuit({ name: 'Schematic' });
  circuit.parts.push(
    createPartInstance('battery', { id: 'bt1', position: { x: 0, y: 20 }, params: { voltage: 9 } }),
    createPartInstance('resistor', { id: 'r1', position: { x: 0, y: 22 }, params: { resistance: 220 } }),
    createPartInstance('led', { id: 'd1', position: { x: 0, y: 24 }, params: { color: 'red' } }),
  );
  circuit.wires.push(
    createWire({ kind: 'pin', partId: 'bt1', pinId: 'positive' }, { kind: 'pin', partId: 'r1', pinId: 'a' }),
    createWire({ kind: 'pin', partId: 'r1', pinId: 'b' }, { kind: 'pin', partId: 'd1', pinId: 'anode' }),
    createWire({ kind: 'pin', partId: 'd1', pinId: 'cathode' }, { kind: 'pin', partId: 'bt1', pinId: 'negative' }),
  );
  return circuit;
}

it('keeps the schematic nets identical to the breadboard netlist', () => {
  const circuit = seriesCircuit();
  const registry = createDefaultPartRegistry();
  const netlist = extractNetlist(circuit, registry);

  const layout = layoutSchematic(circuit, netlist, registry);

  expect(layout.nodes).toHaveLength(3);
  expect(layout.nets.map((net) => ({ name: net.name, isGround: net.isGround, pins: net.pins }))).toEqual(
    netlist.nets.map((net) => ({ name: net.name, isGround: net.isGround, pins: net.pins })),
  );
  expect(layout.nets.some((net) => net.isGround && net.label === 'GND')).toBe(true);
});

it('uses manifest schematic symbols and exports SVG', () => {
  const circuit = seriesCircuit();
  const registry = createDefaultPartRegistry();
  const netlist = extractNetlist(circuit, registry);
  const layout = layoutSchematic(circuit, netlist, registry);

  const symbols = layout.nodes.map((node) => node.symbol);
  expect(symbols).toContain('resistor');
  expect(symbols).toContain('led');

  const svg = schematicToSvg(layout);
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg).toContain('Resistor');
  expect(svg).toContain('GND');
});
