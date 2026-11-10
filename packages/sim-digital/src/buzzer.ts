import type { Level } from './levels';

export type BuzzerKind = 'active' | 'passive';

/** Active buzzers sound while driven; passive buzzers follow the drive waveform. */
export function buzzerLevel(driven: boolean): Level {
  return driven ? '1' : '0';
}
