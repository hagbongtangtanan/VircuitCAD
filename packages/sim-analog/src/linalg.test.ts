import { expect, it } from 'vitest';

import { LuDecomposition } from './linalg';

function solve(matrix: number[][], rhs: number[]): { x: number[]; singular: boolean } {
  const n = matrix.length;
  const flat = new Float64Array(n * n);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) flat[i * n + j] = matrix[i]?.[j] ?? 0;
  }
  const lu = new LuDecomposition();
  lu.factor(flat, n);
  return { x: Array.from(lu.solve(Float64Array.from(rhs))), singular: lu.isSingular() };
}

it('solves a 2x2 system', () => {
  const { x, singular } = solve(
    [
      [2, 1],
      [1, 3],
    ],
    [3, 5],
  );
  expect(singular).toBe(false);
  expect(x[0]).toBeCloseTo(0.8, 9);
  expect(x[1]).toBeCloseTo(1.4, 9);
});

it('solves a 3x3 system', () => {
  const { x } = solve(
    [
      [4, 1, 0],
      [1, 4, 1],
      [0, 1, 4],
    ],
    [1, 0, 1],
  );
  // verified by substitution
  const m = [
    [4, 1, 0],
    [1, 4, 1],
    [0, 1, 4],
  ];
  for (let i = 0; i < 3; i += 1) {
    const row = m[i] ?? [];
    const sum = (row[0] ?? 0) * (x[0] ?? 0) + (row[1] ?? 0) * (x[1] ?? 0) + (row[2] ?? 0) * (x[2] ?? 0);
    expect(sum).toBeCloseTo([1, 0, 1][i] ?? 0, 9);
  }
});

it('detects a singular matrix', () => {
  const { singular } = solve(
    [
      [1, 2],
      [2, 4],
    ],
    [1, 2],
  );
  expect(singular).toBe(true);
});

it('reuses factorization buffers across factor calls', () => {
  const lu = new LuDecomposition();
  lu.factor(new Float64Array([2, 0, 0, 2]), 2);
  expect(lu.solve(Float64Array.from([4, 6]))).toEqual(Float64Array.from([2, 3]));
  lu.factor(new Float64Array([1, 0, 0, 1]), 2);
  expect(lu.solve(Float64Array.from([7, 8]))).toEqual(Float64Array.from([7, 8]));
});
