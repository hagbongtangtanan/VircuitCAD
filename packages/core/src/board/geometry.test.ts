import { expect, it } from 'vitest';

import { BOARD_COLUMNS, generateBoardGeometry } from './geometry';

it('generates the expected hole and strip counts for the full board', () => {
  const geometry = generateBoardGeometry('full');
  expect(geometry.holes).toHaveLength(420);
  expect(geometry.strips).toHaveLength(68);
  expect(geometry.holes.filter((hole) => hole.kind === 'terminal')).toHaveLength(300);
  expect(geometry.holes.filter((hole) => hole.kind === 'rail')).toHaveLength(120);
});

it('generates the expected hole and strip counts for the half board', () => {
  const geometry = generateBoardGeometry('half');
  expect(geometry.holes).toHaveLength(210);
  expect(geometry.strips).toHaveLength(32);
});

it('groups each 5-hole column into one strip and rails into lines', () => {
  const geometry = generateBoardGeometry('full');
  const topStrip = geometry.stripOf('a1');
  expect(topStrip).toBe('strip:col:top:1');
  for (const row of ['a', 'b', 'c', 'd', 'e']) {
    expect(geometry.stripOf(`${row}1`)).toBe(topStrip);
  }
  expect(geometry.stripOf('f1')).toBe('strip:col:bottom:1');
  expect(geometry.stripOf('a1')).not.toBe(geometry.stripOf('f1'));

  const strip = geometry.strips.find((candidate) => candidate.id === topStrip);
  expect(strip?.holes).toEqual(['a1', 'b1', 'c1', 'd1', 'e1']);
});

it('splits the full-board power rails at mid-board but not on the half board', () => {
  const full = generateBoardGeometry('full');
  expect(full.stripOf('top:+1')).toBe('strip:rail:top:+:left');
  expect(full.stripOf(`top:+${BOARD_COLUMNS}`)).toBe('strip:rail:top:+:right');
  expect(full.stripOf('top:+1')).not.toBe(full.stripOf(`top:+${BOARD_COLUMNS}`));

  const half = generateBoardGeometry('half');
  expect(half.stripOf('top:+1')).toBe('strip:rail:top:+:all');
  expect(half.stripOf(`top:+${BOARD_COLUMNS}`)).toBe('strip:rail:top:+:all');
});

it('exposes unique ids, consistent positions and exhaustive strips', () => {
  const geometry = generateBoardGeometry('full');
  const ids = new Set(geometry.holes.map((hole) => hole.id));
  expect(ids.size).toBe(geometry.holes.length);

  const stripHoleCount = geometry.strips.reduce((total, strip) => total + strip.holes.length, 0);
  expect(stripHoleCount).toBe(geometry.holes.length);

  const hole = geometry.holeAt('a', 5);
  expect(hole?.position).toEqual({ x: 4, y: 3 });
  expect(geometry.rows).toContain('a');
  expect(geometry.rows).toContain('bottom:-');
});
