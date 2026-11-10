export type Level = '0' | '1' | 'Z' | 'X';

export function and(a: Level, b: Level): Level {
  if (a === '0' || b === '0') return '0';
  if (a === '1' && b === '1') return '1';
  return 'X';
}

export function or(a: Level, b: Level): Level {
  if (a === '1' || b === '1') return '1';
  if (a === '0' && b === '0') return '0';
  return 'X';
}

export function not(a: Level): Level {
  if (a === '0') return '1';
  if (a === '1') return '0';
  return 'X';
}

export function nand(a: Level, b: Level): Level {
  return not(and(a, b));
}

export function xor(a: Level, b: Level): Level {
  if ((a === '0' || a === '1') && (b === '0' || b === '1')) return a === b ? '0' : '1';
  return 'X';
}

/** Wired connection of two drivers: conflicts resolve to X, undriven to Z. */
export function drive(a: Level, b: Level): Level {
  const active = [a, b].filter((value) => value === '0' || value === '1');
  const first = active[0];
  if (first === undefined) return 'Z';
  return active.every((value) => value === first) ? first : 'X';
}

export function isDriven(level: Level): boolean {
  return level === '0' || level === '1';
}
