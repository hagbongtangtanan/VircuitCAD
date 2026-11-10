export type ScopeSample = { t: number; v: number };
export type ScopeBucket = { t: number; min: number; max: number };
export type TriggerEdge = 'rising' | 'falling';

/** Bounded sample store (oldest dropped first). */
export class ScopeBuffer {
  private samples: ScopeSample[] = [];

  constructor(private readonly limit = 20_000) {}

  push(sample: ScopeSample): void {
    this.samples.push(sample);
    if (this.samples.length > this.limit) {
      this.samples.splice(0, this.samples.length - this.limit);
    }
  }

  clear(): void {
    this.samples = [];
  }

  toArray(): ScopeSample[] {
    return [...this.samples];
  }

  get size(): number {
    return this.samples.length;
  }
}

/** Min/max decimation onto a uniform pixel grid (scope-style peak detection). */
export function decimate(samples: readonly ScopeSample[], pixels: number): ScopeBucket[] {
  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last || pixels <= 0) return [];

  const span = Math.max(1e-12, last.t - first.t);
  const buckets: ScopeBucket[] = Array.from({ length: pixels }, (_, index) => ({
    t: first.t + (span * index) / pixels,
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
  }));

  for (const sample of samples) {
    let index = Math.floor(((sample.t - first.t) / span) * pixels);
    if (index < 0) index = 0;
    if (index >= pixels) index = pixels - 1;
    const bucket = buckets[index];
    if (!bucket) continue;
    if (sample.v < bucket.min) bucket.min = sample.v;
    if (sample.v > bucket.max) bucket.max = sample.v;
  }

  return buckets.filter((bucket) => bucket.min !== Number.POSITIVE_INFINITY);
}

/** First level crossing of the requested edge (index of the sample that crosses). */
export function findTrigger(
  samples: readonly ScopeSample[],
  level: number,
  edge: TriggerEdge = 'rising',
): number {
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (!previous || !current) continue;
    if (edge === 'rising' && previous.v < level && current.v >= level) return index;
    if (edge === 'falling' && previous.v > level && current.v <= level) return index;
  }
  return -1;
}
