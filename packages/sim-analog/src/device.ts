export type MnaContext = {
  readonly numNodes: number;
  voltage(node: number): number;
  addConductance(a: number, b: number, conductance: number): void;
  addCurrent(from: number, to: number, current: number): void;
  addVoltageSource(positive: number, negative: number): number;
  setVoltageSource(branch: number, voltage: number): void;
};

export interface Device {
  readonly name: string;
  readonly nodes: readonly number[];
  stamp(ctx: MnaContext): void;
  update?(solution: Float64Array): void;
  limit?(solution: Float64Array): boolean;
  breakpoints?(): number[];
}
