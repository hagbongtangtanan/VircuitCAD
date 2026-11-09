import { and, nand, not, or, xor, type Level } from './levels';

export type Gate = {
  id: string;
  inputs: readonly string[];
  output: string;
  evaluate: (inputs: readonly Level[]) => Level;
};

export type SettleResult = {
  levels: Record<string, Level>;
  iterations: number;
  settled: boolean;
};

/** Event-driven settling: evaluate gates until no node changes, with an iteration cap. */
export class DigitalEngine {
  private readonly values = new Map<string, Level>();
  private readonly gates: Gate[] = [];

  constructor(initial: Record<string, Level> = {}) {
    for (const [node, level] of Object.entries(initial)) this.values.set(node, level);
  }

  addGate(gate: Gate): void {
    this.gates.push(gate);
  }

  get(node: string): Level {
    return this.values.get(node) ?? 'Z';
  }

  set(node: string, level: Level): void {
    this.values.set(node, level);
  }

  settle(maxIterations = 100): SettleResult {
    let iterations = 0;
    let changed = true;
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations += 1;
      for (const gate of this.gates) {
        const output = gate.evaluate(gate.inputs.map((input) => this.get(input)));
        if (this.get(gate.output) !== output) {
          this.values.set(gate.output, output);
          changed = true;
        }
      }
    }
    return { levels: Object.fromEntries(this.values), iterations, settled: !changed };
  }
}

export const gates = { and, or, not, nand, xor };
