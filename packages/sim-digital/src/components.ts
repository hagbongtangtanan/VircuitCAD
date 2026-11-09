/** Edge-triggered D flip-flop (7474-style). */
export class DFlipFlop {
  private q = false;
  private lastClock = false;

  get Q(): boolean {
    return this.q;
  }

  get Qbar(): boolean {
    return !this.q;
  }

  step(clock: boolean, d: boolean, options: { preset?: boolean; clear?: boolean } = {}): void {
    if (options.clear) {
      this.q = false;
    } else if (options.preset) {
      this.q = true;
    } else if (clock && !this.lastClock) {
      this.q = d;
    }
    this.lastClock = clock;
  }

  reset(): void {
    this.q = false;
    this.lastClock = false;
  }
}

export type CounterStep = {
  clock: boolean;
  enable?: boolean;
  reset?: boolean;
  loadValue?: number;
};

/** Synchronous up-counter (74HC161-style), 4-bit by default. */
export class Counter {
  private value = 0;
  private lastClock = false;

  constructor(private readonly bits = 4) {}

  get count(): number {
    return this.value;
  }

  step({ clock, enable = true, reset = false, loadValue }: CounterStep): void {
    const rising = clock && !this.lastClock;
    this.lastClock = clock;
    if (rising) {
      if (reset) this.value = 0;
      else if (loadValue !== undefined) this.value = loadValue & this.mask;
      else if (enable) this.value = (this.value + 1) & this.mask;
    }
  }

  private get mask(): number {
    return (1 << this.bits) - 1;
  }

  reset(): void {
    this.value = 0;
    this.lastClock = false;
  }
}

export type ShiftStep = {
  clock: boolean;
  serial: boolean;
  clear?: boolean;
};

/** Serial-in/parallel-out shift register (74HC595-style, 8-bit). */
export class ShiftRegister {
  private data = 0;
  private lastClock = false;

  constructor(private readonly bits = 8) {}

  get value(): number {
    return this.data;
  }

  bit(index: number): boolean {
    return ((this.data >> index) & 1) === 1;
  }

  step({ clock, serial, clear = false }: ShiftStep): void {
    const rising = clock && !this.lastClock;
    this.lastClock = clock;
    if (!rising) return;
    if (clear) {
      this.data = 0;
      return;
    }
    const mask = (1 << this.bits) - 1;
    this.data = ((this.data << 1) | (serial ? 1 : 0)) & mask;
  }
}
