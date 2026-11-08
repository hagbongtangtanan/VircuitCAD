import { expect, it } from 'vitest';

import { setupDevices } from './context';
import type { Device } from './device';
import { createDiode } from './devices/nonlinear';
import { createResistor } from './devices/resistor';
import { createVoltageSource } from './devices/voltage-source';
import { assertHasGround, findFloatingNodes, solveDcOrThrow } from './diagnostics';
import { SimError } from './errors';
import { MnaSystem } from './mna';

function run(nodeCount: number, devices: Device[]) {
  const system = new MnaSystem(nodeCount);
  setupDevices(system, devices);
  return () => solveDcOrThrow(system, devices);
}

it('reports NO_GROUND when the reference net is missing', () => {
  try {
    assertHasGround(false);
    throw new Error('expected throw');
  } catch (error) {
    expect(error).toBeInstanceOf(SimError);
    expect((error as SimError).code).toBe('NO_GROUND');
  }
});

it('reports FLOATING nodes with refs', () => {
  const runCircuit = run(2, [createResistor('r1', 1, 0, 100)]);
  try {
    runCircuit();
    throw new Error('expected throw');
  } catch (error) {
    expect((error as SimError).code).toBe('FLOATING');
    expect((error as SimError).refs).toEqual([{ kind: 'node', id: '2' }]);
  }
});

it('reports a SHORT_CIRCUIT for a source across a single node', () => {
  const runCircuit = run(1, [createVoltageSource('v1', 1, 1, 5, 0)]);
  try {
    runCircuit();
    throw new Error('expected throw');
  } catch (error) {
    expect((error as SimError).code).toBe('SHORT_CIRCUIT');
  }
});

it('reports a SOURCE_LOOP for parallel ideal sources', () => {
  const runCircuit = run(1, [
    createVoltageSource('v1', 1, 0, 5, 0),
    createVoltageSource('v2', 1, 0, 9, 0),
    createResistor('r1', 1, 0, 1000),
  ]);
  try {
    runCircuit();
    throw new Error('expected throw');
  } catch (error) {
    expect((error as SimError).code).toBe('SOURCE_LOOP');
  }
});

it('reports NO_CONVERGENCE when the iteration cap is too low', () => {
  const devices = [
    createVoltageSource('v1', 1, 0, 5, 0),
    createResistor('r1', 1, 2, 1000),
    createDiode('d1', 2, 0),
  ];
  const system = new MnaSystem(2);
  setupDevices(system, devices);
  try {
    solveDcOrThrow(system, devices, { maxIterations: 1 });
    throw new Error('expected throw');
  } catch (error) {
    expect((error as SimError).code).toBe('NO_CONVERGENCE');
  }
});

it('detects touched vs floating nodes', () => {
  expect(findFloatingNodes(3, [createResistor('r1', 1, 2, 100)])).toEqual([3]);
  expect(findFloatingNodes(3, [createResistor('r1', 1, 2, 100), createResistor('r2', 3, 0, 100)])).toEqual([]);
});
