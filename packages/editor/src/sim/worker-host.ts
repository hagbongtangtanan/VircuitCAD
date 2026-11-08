import type { Circuit, ParamValue } from '@vircuitcad/core';
import {
  WorkerEventSchema,
  type SimErrorEvent,
  type SimSnapshot,
  type SimStatus,
} from '@vircuitcad/sim-analog';

export class SimulationHost {
  private worker: Worker | undefined;

  onSnapshot?: (snapshot: SimSnapshot) => void;
  onStatus?: (status: SimStatus) => void;
  onError?: (event: SimErrorEvent) => void;

  start(circuit: Circuit): void {
    this.ensure().postMessage({ type: 'start', circuit });
  }

  stop(): void {
    this.worker?.postMessage({ type: 'stop' });
  }

  pause(): void {
    this.worker?.postMessage({ type: 'pause' });
  }

  resume(): void {
    this.worker?.postMessage({ type: 'resume' });
  }

  setParam(partId: string, key: string, value: ParamValue): void {
    this.worker?.postMessage({ type: 'setParam', partId, key, value });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
  }

  private ensure(): Worker {
    if (!this.worker) {
      const worker = new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent) => this.handle(event.data);
      this.worker = worker;
    }
    return this.worker;
  }

  private handle(data: unknown): void {
    const parsed = WorkerEventSchema.safeParse(data);
    if (!parsed.success) return;
    const event = parsed.data;
    if (event.type === 'snapshot') this.onSnapshot?.(event);
    else if (event.type === 'status') this.onStatus?.(event);
    else this.onError?.(event);
  }
}
