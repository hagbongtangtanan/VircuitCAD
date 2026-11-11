import { DEFAULT_SKETCH_FILE, sketchOf, type Circuit } from '../model/circuit';

/** The project's active Arduino sketch source (`.ino` export). */
export function toIno(circuit: Circuit): string {
  return sketchOf(circuit).files[DEFAULT_SKETCH_FILE] ?? '';
}
