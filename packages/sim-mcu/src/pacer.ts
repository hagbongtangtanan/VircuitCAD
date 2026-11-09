export type PacerOptions = {
  speed?: number;
  /** Maximum simulated microseconds advanced in a single frame (backlog cap). */
  maxFrameMicros?: number;
};

export type PacerTick = {
  /** Simulated microseconds the caller should run for this frame. */
  micros: number;
  /** simulated / real-time ratio for this frame (1 = keeping up). */
  realTimeFactor: number;
  /** True when the frame hit the backlog cap (could not keep up). */
  overloaded: boolean;
};

export class Pacer {
  private speed: number;
  private readonly maxFrameMicros: number;
  private lastMs: number | undefined;

  constructor(options: PacerOptions = {}) {
    this.speed = options.speed ?? 1;
    this.maxFrameMicros = options.maxFrameMicros ?? 100_000;
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0, speed);
  }

  getSpeed(): number {
    return this.speed;
  }

  reset(nowMs?: number): void {
    this.lastMs = nowMs;
  }

  tick(nowMs: number): PacerTick {
    if (this.lastMs === undefined) {
      this.lastMs = nowMs;
      return { micros: 0, realTimeFactor: 1, overloaded: false };
    }

    const realMs = Math.max(0, nowMs - this.lastMs);
    this.lastMs = nowMs;
    const wanted = realMs * 1000 * this.speed;
    const micros = Math.min(wanted, this.maxFrameMicros);
    const realTimeFactor = realMs > 0 ? micros / (realMs * 1000) : 1;
    return { micros, realTimeFactor, overloaded: micros < wanted };
  }
}
