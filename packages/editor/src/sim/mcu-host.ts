import {
  McuEventSchema,
  type McuPinChangeEvent,
  type McuPort,
  type McuSerialEvent,
  type McuStateEvent,
} from '@vircuitcad/sim-mcu';

export class McuHost {
  private worker: Worker | undefined;

  onPinChange?: (event: McuPinChangeEvent) => void;
  onSerial?: (event: McuSerialEvent) => void;
  onState?: (event: McuStateEvent) => void;

  start(hex: string): void {
    this.ensure().postMessage({ type: 'start', hex });
  }

  pause(): void {
    this.worker?.postMessage({ type: 'pause' });
  }

  resume(): void {
    this.worker?.postMessage({ type: 'resume' });
  }

  reset(): void {
    this.worker?.postMessage({ type: 'reset' });
  }

  setPin(port: McuPort, bit: number, high: boolean): void {
    this.worker?.postMessage({ type: 'setPin', port, bit, high });
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = undefined;
  }

  private ensure(): Worker {
    if (!this.worker) {
      const worker = new Worker(new URL('./mcu.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent) => this.handle(event.data);
      this.worker = worker;
    }
    return this.worker;
  }

  private handle(data: unknown): void {
    const parsed = McuEventSchema.safeParse(data);
    if (!parsed.success) return;
    const event = parsed.data;
    if (event.type === 'pinChange') this.onPinChange?.(event);
    else if (event.type === 'serial') this.onSerial?.(event);
    else this.onState?.(event);
  }
}
