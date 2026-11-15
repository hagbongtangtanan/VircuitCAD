import {
  generateBoardGeometry,
  TERMINAL_ROWS_BOTTOM,
  TERMINAL_ROWS_TOP,
  type BoardKind,
} from '@vircuitcad/core';

import { circle, rect, text, type ArtPrimitive } from './dsl';
import { ART_UNIT, PALETTE } from './palette';

export const BOARD_BODY = '#d8d3c6';
export const BOARD_TRENCH = '#9a9486';
export const BOARD_RAIL_RED = '#c9463f';
export const BOARD_RAIL_BLUE = '#3b6fd6';
export const BOARD_HOLE = '#2a2a2a';
export const BOARD_TEXT = '#4a4a44';

export type BoardHoleMarker = { id: string; x: number; y: number };

export type BoardArt = {
  width: number;
  height: number;
  body: string;
  /** Body, trench, rail stripes and +/- marks — always drawn. */
  primitives: ArtPrimitive[];
  /** Column numbers and row letters — shown above the zoom threshold. */
  labels: ArtPrimitive[];
  /** Hole centres in world pixels (grid × ART_UNIT). */
  holeMarkers: BoardHoleMarker[];
};

const RAIL_COLORS: Record<string, string> = {
  'top:+': BOARD_RAIL_RED,
  'top:-': BOARD_RAIL_BLUE,
  'bottom:+': BOARD_RAIL_RED,
  'bottom:-': BOARD_RAIL_BLUE,
};

/** Original breadboard artwork drawn from the board geometry (docs/DESIGN.md 3.3). */
export function buildBreadboardArt(kind: BoardKind): BoardArt {
  const geometry = generateBoardGeometry(kind);
  const xs = geometry.holes.map((hole) => hole.position.x);
  const ys = geometry.holes.map((hole) => hole.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  const margin = 1.2;
  const left = (minX - margin) * ART_UNIT;
  const top = (minY - margin) * ART_UNIT;
  const width = (maxX - minX + margin * 2) * ART_UNIT;
  const height = (maxY - minY + margin * 2) * ART_UNIT;

  const primitives: ArtPrimitive[] = [
    rect(left, top, width, height, BOARD_BODY, {
      radius: 8,
      stroke: PALETTE.outline,
      strokeWidth: 1,
    }),
  ];
  const labels: ArtPrimitive[] = [];

  if (kind === 'full') {
    primitives.push(rect(left, 8 * ART_UNIT - ART_UNIT * 0.35, width, ART_UNIT * 0.7, BOARD_TRENCH));
  }

  const railRows = new Set<string>();
  for (const hole of geometry.holes) {
    if (hole.kind !== 'rail') continue;
    railRows.add(hole.row);
    const color = RAIL_COLORS[hole.row] ?? BOARD_RAIL_RED;
    primitives.push(
      rect(hole.position.x * ART_UNIT - ART_UNIT * 0.42, hole.position.y * ART_UNIT - ART_UNIT * 0.32, ART_UNIT * 0.84, ART_UNIT * 0.64, color),
    );
  }

  for (const row of railRows) {
    const sample = geometry.holes.find((hole) => hole.row === row);
    if (!sample) continue;
    const mark = row.endsWith('+') ? '+' : '−';
    const y = sample.position.y * ART_UNIT + 3;
    labels.push(text((minX - margin * 0.5) * ART_UNIT, y, mark, BOARD_TEXT, 12, 'middle'));
    labels.push(text((maxX + margin * 0.5) * ART_UNIT, y, mark, BOARD_TEXT, 12, 'middle'));
  }

  const holeMarkers: BoardHoleMarker[] = geometry.holes.map((hole) => ({
    id: hole.id,
    x: hole.position.x * ART_UNIT,
    y: hole.position.y * ART_UNIT,
  }));

  for (let column = 1; column <= geometry.columns; column += 1) {
    const x = (column - 1) * ART_UNIT;
    labels.push(text(x, top + ART_UNIT * 0.55, String(column), BOARD_TEXT, 9, 'middle'));
    labels.push(text(x, top + height - ART_UNIT * 0.2, String(column), BOARD_TEXT, 9, 'middle'));
  }

  const letters: string[] = [
    ...TERMINAL_ROWS_TOP,
    ...(kind === 'full' ? TERMINAL_ROWS_BOTTOM : []),
  ];
  letters.forEach((letter, index) => {
    const row = index < TERMINAL_ROWS_TOP.length ? 3 + index : 9 + (index - TERMINAL_ROWS_TOP.length);
    const y = row * ART_UNIT + 3;
    labels.push(text(left + ART_UNIT * 0.5, y, letter, BOARD_TEXT, 9, 'middle'));
    labels.push(text(left + width - ART_UNIT * 0.5, y, letter, BOARD_TEXT, 9, 'middle'));
  });

  return { width, height, body: BOARD_BODY, primitives, labels, holeMarkers };
}

export function boardHoleCircles(art: BoardArt, radius: number, color: string): ArtPrimitive[] {
  return art.holeMarkers.map((hole) => circle(hole.x, hole.y, radius, color));
}
