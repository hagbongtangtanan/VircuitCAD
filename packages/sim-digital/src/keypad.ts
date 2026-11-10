export const KEYPAD_4X4: readonly (readonly string[])[] = [
  ['1', '2', '3', 'A'],
  ['4', '5', '6', 'B'],
  ['7', '8', '9', 'C'],
  ['*', '0', '#', 'D'],
];

/** 4×4 membrane keypad: track the currently-pressed (row, column). */
export class Keypad4x4 {
  private row = -1;
  private col = -1;

  press(row: number, col: number): void {
    if (row >= 0 && row < 4 && col >= 0 && col < 4) {
      this.row = row;
      this.col = col;
    }
  }

  release(): void {
    this.row = -1;
    this.col = -1;
  }

  get key(): string | null {
    if (this.row < 0 || this.col < 0) return null;
    return KEYPAD_4X4[this.row]?.[this.col] ?? null;
  }
}

export type PirState = '0' | '1';

export function pirLevel(motion: boolean): PirState {
  return motion ? '1' : '0';
}
