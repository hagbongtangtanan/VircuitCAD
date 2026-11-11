import { expect, it } from 'vitest';

import { createEmptyCircuit, createPartInstance, createWire } from '../model/circuit';
import { createDefaultPartRegistry } from '../parts/catalog';
import { toBomCsv } from './bom';
import { toIno } from './ino';
import { toSpiceNetlist } from './spice';

function seriesCircuit() {
  const circuit = createEmptyCircuit({ name: 'Series' });
  circuit.parts.push(
    createPartInstance('battery', { id: 'bt1', position: { x: 0, y: 20 }, params: { voltage: 9 } }),
    createPartInstance('resistor', { id: 'r1', position: { x: 0, y: 22 }, params: { resistance: 220 } }),
    createPartInstance('capacitor', { id: 'c1', position: { x: 0, y: 24 }, params: { capacitance: 1e-6 } }),
  );
  circuit.wires.push(
    createWire({ kind: 'pin', partId: 'bt1', pinId: 'positive' }, { kind: 'pin', partId: 'r1', pinId: 'a' }),
    createWire({ kind: 'pin', partId: 'r1', pinId: 'b' }, { kind: 'pin', partId: 'c1', pinId: 'a' }),
    createWire({ kind: 'pin', partId: 'c1', pinId: 'b' }, { kind: 'pin', partId: 'bt1', pinId: 'negative' }),
  );
  return circuit;
}

it('exports a SPICE netlist with numbered nodes', () => {
  const registry = createDefaultPartRegistry();
  expect(toSpiceNetlist(seriesCircuit(), registry)).toBe(
    ['* VircuitCAD netlist: Series', 'Vbt1 1 0 9', 'Rr1 1 2 220', 'Cc1 2 0 1e-6', ''].join('\n'),
  );
});

it('exports a BOM grouped by part, sorted by id', () => {
  const registry = createDefaultPartRegistry();
  const bom = toBomCsv(seriesCircuit(), registry);
  expect(bom).toBe(
    [
      'partId,name,quantity,references',
      'battery,Battery,1,bt1',
      'capacitor,Capacitor,1,c1',
      'resistor,Resistor,1,r1',
      '',
    ].join('\n'),
  );
});

it('exports the sketch as .ino', () => {
  const circuit = seriesCircuit();
  circuit.sketch = { files: { 'sketch.ino': 'void setup() {}\n' } };
  expect(toIno(circuit)).toBe('void setup() {}\n');
});

it('falls back to the default sketch when none is set', () => {
  const circuit = createEmptyCircuit();
  expect(toIno(circuit)).toContain('void setup');
});
