export class SingularMatrixError extends Error {
  constructor(message = 'matrix is singular') {
    super(message);
    this.name = 'SingularMatrixError';
  }
}

const PIVOT_EPSILON = 1e-14;

export class LuDecomposition {
  private size = 0;
  private lu = new Float64Array(0);
  private pivots = new Int32Array(0);
  private singular = false;

  factor(matrix: Float64Array, size: number): void {
    const n = size;
    this.size = n;
    this.singular = false;
    if (this.lu.length < n * n) this.lu = new Float64Array(n * n);
    if (this.pivots.length < n) this.pivots = new Int32Array(n);

    const lu = this.lu;
    const pivots = this.pivots;
    lu.set(matrix.subarray(0, n * n));
    for (let index = 0; index < n; index += 1) pivots[index] = index;

    for (let k = 0; k < n; k += 1) {
      let max = 0;
      let pivotRow = k;
      for (let i = k; i < n; i += 1) {
        const value = Math.abs(lu[i * n + k] ?? 0);
        if (value > max) {
          max = value;
          pivotRow = i;
        }
      }

      if (max < PIVOT_EPSILON) {
        this.singular = true;
        continue;
      }

      if (pivotRow !== k) {
        for (let j = 0; j < n; j += 1) {
          const tmp = lu[k * n + j] ?? 0;
          lu[k * n + j] = lu[pivotRow * n + j] ?? 0;
          lu[pivotRow * n + j] = tmp;
        }
        const tmpPivot = pivots[k] ?? k;
        pivots[k] = pivots[pivotRow] ?? pivotRow;
        pivots[pivotRow] = tmpPivot;
      }

      const diagonal = lu[k * n + k] ?? 0;
      for (let i = k + 1; i < n; i += 1) {
        const factor = (lu[i * n + k] ?? 0) / diagonal;
        lu[i * n + k] = factor;
        for (let j = k + 1; j < n; j += 1) {
          lu[i * n + j] = (lu[i * n + j] ?? 0) - factor * (lu[k * n + j] ?? 0);
        }
      }
    }
  }

  isSingular(): boolean {
    return this.singular;
  }

  solve(rhs: Float64Array): Float64Array {
    const n = this.size;
    const lu = this.lu;
    const x = new Float64Array(n);

    for (let i = 0; i < n; i += 1) x[i] = rhs[this.pivots[i] ?? i] ?? 0;

    for (let i = 0; i < n; i += 1) {
      let sum = x[i] ?? 0;
      for (let j = 0; j < i; j += 1) sum -= (lu[i * n + j] ?? 0) * (x[j] ?? 0);
      x[i] = sum;
    }

    for (let i = n - 1; i >= 0; i -= 1) {
      let sum = x[i] ?? 0;
      for (let j = i + 1; j < n; j += 1) sum -= (lu[i * n + j] ?? 0) * (x[j] ?? 0);
      const diagonal = lu[i * n + i] ?? 0;
      x[i] = diagonal === 0 ? 0 : sum / diagonal;
    }

    return x;
  }
}
