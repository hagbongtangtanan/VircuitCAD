import { McuCommandSchema, McuCpu, Pacer, type PortName } from '@vircuitcad/sim-mcu';

type WorkerScope = {
  postMessage(message: unknown): void;
  onmessage: ((event: MessageEvent) => void) | null;
};

const scope = self as unknown as WorkerScope;
const PORTS: PortName[] = ['B', 'C', 'D'];
const pacer = new Pacer({ maxFrameMicros: 100_000 });

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

let mcu: McuCpu | undefined;
let running = false;
let timer: ReturnType<typeof setInterval> | undefined;

function attach(instance: McuCpu): void {
  for (const port of PORTS) {
    instance.onPortChange(port, (value, oldValue) => {
      scope.postMessage({ type: 'pinChange', cycles: instance.cycles, port, value, oldValue });
    });
  }
  instance.onSerial((byte) => scope.postMessage({ type: 'serial', byte }));
}

function frame(): void {
  if (!mcu || !running) return;
  const tick = pacer.tick(now());
  if (tick.micros > 0) mcu.runMicros(tick.micros);
  scope.postMessage({
    type: 'state',
    running,
    cycles: mcu.cycles,
    realTimeFactor: tick.realTimeFactor,
    overloaded: tick.overloaded,
  });
}

scope.onmessage = (event: MessageEvent): void => {
  const parsed = McuCommandSchema.safeParse(event.data);
  if (!parsed.success) return;
  const command = parsed.data;
  switch (command.type) {
    case 'start':
      mcu = new McuCpu(command.hex);
      attach(mcu);
      running = true;
      pacer.reset(now());
      if (!timer) timer = setInterval(frame, 1000 / 60);
      frame();
      break;
    case 'pause':
      running = false;
      scope.postMessage({ type: 'state', running, cycles: mcu?.cycles ?? 0 });
      break;
    case 'resume':
      running = true;
      break;
    case 'reset':
      mcu?.reset();
      scope.postMessage({ type: 'state', running, cycles: mcu?.cycles ?? 0 });
      break;
    case 'setPin':
      mcu?.setPin(command.port as PortName, command.bit, command.high);
      break;
  }
};
