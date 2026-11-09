import {
  AVRIOPort,
  AVRUSART,
  AVRTimer,
  CPU,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  usart0Config,
  type GPIOListener,
} from 'avr8js';

import { parseIntelHex } from './intel-hex';

export type PortName = 'B' | 'C' | 'D';
export const CLOCK_HZ = 16_000_000;
const BYTES_PER_MICRO = CLOCK_HZ / 1e6;

function programWords(hex: string): Uint16Array {
  const { bytes } = parseIntelHex(hex);
  const words = new Uint16Array(bytes.length / 2);
  for (let index = 0; index < words.length; index += 1) {
    words[index] = (bytes[index * 2] ?? 0) | ((bytes[index * 2 + 1] ?? 0) << 8);
  }
  return words;
}

export class McuCpu {
  readonly cpu: CPU;
  private readonly ports: Record<PortName, AVRIOPort>;
  readonly usart: AVRUSART;

  constructor(hex: string) {
    this.cpu = new CPU(programWords(hex));
    new AVRTimer(this.cpu, timer0Config);
    new AVRTimer(this.cpu, timer1Config);
    new AVRTimer(this.cpu, timer2Config);
    this.ports = {
      B: new AVRIOPort(this.cpu, portBConfig),
      C: new AVRIOPort(this.cpu, portCConfig),
      D: new AVRIOPort(this.cpu, portDConfig),
    };
    this.usart = new AVRUSART(this.cpu, usart0Config, CLOCK_HZ);
  }

  get cycles(): number {
    return this.cpu.cycles;
  }

  get micros(): number {
    return this.cpu.cycles / BYTES_PER_MICRO;
  }

  reset(): void {
    this.cpu.reset();
  }

  /** Runs a fixed number of CPU cycles (deterministic). */
  runCycles(count: number): void {
    const target = this.cpu.cycles + count;
    while (this.cpu.cycles < target) {
      avrInstruction(this.cpu);
      this.cpu.tick();
    }
  }

  runMicros(micros: number): void {
    this.runCycles(Math.round(micros * BYTES_PER_MICRO));
  }

  onPortChange(port: PortName, listener: GPIOListener): void {
    this.ports[port].addListener(listener);
  }

  setPin(port: PortName, bit: number, high: boolean): void {
    this.ports[port].setPin(bit, high);
  }

  onSerial(listener: (value: number) => void): void {
    this.usart.onByteTransmit = listener;
  }
}
