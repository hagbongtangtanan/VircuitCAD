import type { MnaSystem } from './mna';

export type MnaContext = {
  readonly numNodes: number;
  voltage(node: number): number;
  addConductance(a: number, b: number, conductance: number): void;
  addCurrent(from: number, to: number, current: number): void;
  stampVoltageSource(positive: number, negative: number, branch: number): void;
  addBranchResistance(branch: number, resistance: number): void;
  setVoltageSource(branch: number, voltage: number): void;
};

export interface Device {
  readonly name: string;
  readonly kind?: string;
  readonly nodes: readonly number[];
  setup?(system: MnaSystem): void;
  stamp(ctx: MnaContext): void;
  update?(solution: Float64Array): void;
  limit?(solution: Float64Array): boolean;
  breakpoints?(): number[];
}
