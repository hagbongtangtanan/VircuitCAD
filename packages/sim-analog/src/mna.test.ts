import type { Netlist } from '@vircuitcad/core';
import { expect, it } from 'vitest';

import { MnaSystem } from './mna';
import { buildNodeMap } from './node-map';

const netlist: Netlist = {
  nets: [
    { name: 'GND', isGround: true, pins: [], holes: [] },
    { name: 'N2', isGround: false, pins: [], holes: [] },
    { name: 'N1', isGround: false, pins: [], holes: [] },
  ],
  floatingPins: [],
};

it('indexes nodes deterministically with ground at 0', () => {
  const map = buildNodeMap(netlist);
  expect(map.get('GND')).toBe(0);
  expect(map.get('N1')).toBe(1);
  expect(map.get('N2')).toBe(2);
});

it('solves a floating node without singularity thanks to gmin', () => {
  const system = new MnaSystem(2);
  system.addGmin(1e-12);
  const solution = system.solve();
  expect(system.isSingular()).toBe(false);
  expect(solution[0]).toBe(0);
  expect(solution[1]).toBe(0);
});

it('solves a resistive divider driven by an ideal source', () => {
  // V1(5V) : N1 -> GND ; R1 (10 ohm) N1-N2 ; R2 (10 ohm) N2-GND
  const system = new MnaSystem(2);
  const branch = system.addVoltageSource(1, 0);
  system.setVoltageSource(branch, 5);
  system.addConductance(1, 2, 0.1);
  system.addConductance(2, 0, 0.1);
  system.addGmin(1e-12);

  const solution = system.solve();
  expect(system.isSingular()).toBe(false);
  expect(system.nodeVoltage(solution, 1)).toBeCloseTo(5, 6);
  expect(system.nodeVoltage(solution, 2)).toBeCloseTo(2.5, 6);
  // current through V1: -V/Rtotal
  expect(system.branchCurrent(solution, branch)).toBeCloseTo(-0.25, 6);
});

it('injects current between nodes', () => {
  const system = new MnaSystem(1);
  system.addConductance(1, 0, 0.5); // 2 ohm to ground
  system.addCurrent(0, 1, 2); // 2 A into N1
  const solution = system.solve();
  expect(system.nodeVoltage(solution, 1)).toBeCloseTo(4, 6);
});
