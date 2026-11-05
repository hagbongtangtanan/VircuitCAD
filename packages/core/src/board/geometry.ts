import type { BoardKind, Vec2 } from '../model/circuit';

export const BOARD_COLUMNS = 30;
export const TERMINAL_ROWS_TOP = ['a', 'b', 'c', 'd', 'e'] as const;
export const TERMINAL_ROWS_BOTTOM = ['f', 'g', 'h', 'i', 'j'] as const;

export type HoleKind = 'terminal' | 'rail';

export type Hole = {
  id: string;
  row: string;
  column: number;
  position: Vec2;
  strip: string;
  kind: HoleKind;
};

export type Strip = {
  id: string;
  kind: HoleKind;
  holes: string[];
};

export type BoardGeometry = {
  kind: BoardKind;
  columns: number;
  rows: string[];
  holes: Hole[];
  strips: Strip[];
  hole(id: string): Hole | undefined;
  stripOf(holeId: string): string | undefined;
  holeAt(row: string, column: number): Hole | undefined;
};

type RailLine = { row: string; y: number };

const TERMINAL_Y_TOP = 3;
const TERMINAL_Y_BOTTOM = 9;
const RAIL_TOP: RailLine[] = [
  { row: 'top:+', y: 0 },
  { row: 'top:-', y: 1 },
];
const RAIL_BOTTOM: RailLine[] = [
  { row: 'bottom:+', y: 15 },
  { row: 'bottom:-', y: 16 },
];

function buildRailLine(kind: BoardKind, line: RailLine, columns: number): { holes: Hole[]; strips: Strip[] } {
  const split = kind === 'full';
  const midpoint = Math.ceil(columns / 2);
  const holes: Hole[] = [];
  const bySide = new Map<string, string[]>();

  for (let column = 1; column <= columns; column += 1) {
    const side = split ? (column <= midpoint ? 'left' : 'right') : 'all';
    const stripId = `strip:rail:${line.row}:${side}`;
    const hole: Hole = {
      id: `${line.row}${column}`,
      row: line.row,
      column,
      position: { x: column - 1, y: line.y },
      strip: stripId,
      kind: 'rail',
    };
    holes.push(hole);
    const bucket = bySide.get(stripId) ?? [];
    bucket.push(hole.id);
    bySide.set(stripId, bucket);
  }

  const strips: Strip[] = [...bySide.entries()].map(([id, stripHoles]) => ({
    id,
    kind: 'rail',
    holes: stripHoles,
  }));
  return { holes, strips };
}

function buildTerminalRegion(
  rows: readonly string[],
  startY: number,
  region: string,
  columns: number,
): { holes: Hole[]; strips: Strip[] } {
  const holes: Hole[] = [];
  const stripsByColumn = new Map<number, string[]>();

  rows.forEach((row, rowIndex) => {
    for (let column = 1; column <= columns; column += 1) {
      const hole: Hole = {
        id: `${row}${column}`,
        row,
        column,
        position: { x: column - 1, y: startY + rowIndex },
        strip: `strip:col:${region}:${column}`,
        kind: 'terminal',
      };
      holes.push(hole);
      const bucket = stripsByColumn.get(column) ?? [];
      bucket.push(hole.id);
      stripsByColumn.set(column, bucket);
    }
  });

  const strips: Strip[] = [...stripsByColumn.entries()].map(([column, stripHoles]) => ({
    id: `strip:col:${region}:${column}`,
    kind: 'terminal',
    holes: stripHoles,
  }));
  return { holes, strips };
}

export function generateBoardGeometry(kind: BoardKind): BoardGeometry {
  const columns = BOARD_COLUMNS;
  const holes: Hole[] = [];
  const strips: Strip[] = [];

  const collect = (part: { holes: Hole[]; strips: Strip[] }): void => {
    holes.push(...part.holes);
    strips.push(...part.strips);
  };

  collect(buildTerminalRegion(TERMINAL_ROWS_TOP, TERMINAL_Y_TOP, 'top', columns));
  if (kind === 'full') {
    collect(buildTerminalRegion(TERMINAL_ROWS_BOTTOM, TERMINAL_Y_BOTTOM, 'bottom', columns));
  }

  for (const line of RAIL_TOP) collect(buildRailLine(kind, line, columns));
  if (kind === 'full') {
    for (const line of RAIL_BOTTOM) collect(buildRailLine(kind, line, columns));
  }

  const holesById = new Map(holes.map((hole) => [hole.id, hole]));
  const stripOfHole = new Map(holes.map((hole) => [hole.id, hole.strip]));
  const rows = [
    ...RAIL_TOP.map((line) => line.row),
    ...TERMINAL_ROWS_TOP,
    ...(kind === 'full' ? [...TERMINAL_ROWS_BOTTOM, ...RAIL_BOTTOM.map((line) => line.row)] : []),
  ];

  return {
    kind,
    columns,
    rows,
    holes,
    strips,
    hole: (id) => holesById.get(id),
    stripOf: (holeId) => stripOfHole.get(holeId),
    holeAt: (row, column) => holesById.get(`${row}${column}`),
  };
}
