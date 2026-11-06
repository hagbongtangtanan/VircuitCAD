import { LuDecomposition } from './linalg';

export class MnaSystem {
  readonly nodeCount: number;
  private branchCount = 0;
  private a = new Float64Array(0);
  private z = new Float64Array(0);
  private readonly lu = new LuDecomposition();

  constructor(nodeCount: number) {
    this.nodeCount = nodeCount;
    this.reallocate();
  }

  get branchCount_(): number {
    return this.branchCount;
  }

  get size(): number {
    return this.nodeCount + this.branchCount;
  }

  reset(): void {
    this.a.fill(0, 0, this.size * this.size);
    this.z.fill(0, 0, this.size);
  }

  addConductance(a: number, b: number, conductance: number): void {
    this.stampA(a, a, conductance);
    this.stampA(b, b, conductance);
    this.stampA(a, b, -conductance);
    this.stampA(b, a, -conductance);
  }

  addCurrent(from: number, to: number, current: number): void {
    this.stampZ(from, -current);
    this.stampZ(to, current);
  }

  addVoltageSource(positive: number, negative: number): number {
    const branch = this.branchCount;
    this.branchCount += 1;
    this.reallocate();
    const row = this.nodeCount + branch + 1;
    this.stampA(positive, row, 1);
    this.stampA(negative, row, -1);
    this.stampA(row, positive, 1);
    this.stampA(row, negative, -1);
    return branch;
  }

  setVoltageSource(branch: number, voltage: number): void {
    this.z[this.nodeCount + branch] = voltage;
  }

  addGmin(gmin: number): void {
    for (let node = 1; node <= this.nodeCount; node += 1) this.stampA(node, node, gmin);
  }

  addNodeCapacitance(node: number, conductance: number): void {
    this.stampA(node, node, conductance);
  }

  solve(): Float64Array {
    const size = this.size;
    this.lu.factor(this.a.subarray(0, size * size), size);
    return this.lu.solve(this.z.subarray(0, size));
  }

  isSingular(): boolean {
    return this.lu.isSingular();
  }

  nodeVoltage(solution: Float64Array, node: number): number {
    if (node === 0) return 0;
    return solution[node - 1] ?? 0;
  }

  branchCurrent(solution: Float64Array, branch: number): number {
    return solution[this.nodeCount + branch] ?? 0;
  }

  private reallocate(): void {
    const size = this.size;
    if (this.a.length < size * size) {
      const next = new Float64Array(size * size);
      next.set(this.a);
      this.a = next;
    }
    if (this.z.length < size) {
      const next = new Float64Array(size);
      next.set(this.z);
      this.z = next;
    }
  }

  private stampA(i: number, j: number, value: number): void {
    if (i === 0 || j === 0) return;
    const size = this.size;
    const offset = (i - 1) * size + (j - 1);
    this.a[offset] = (this.a[offset] ?? 0) + value;
  }

  private stampZ(i: number, value: number): void {
    if (i === 0) return;
    this.z[i - 1] = (this.z[i - 1] ?? 0) + value;
  }
}
