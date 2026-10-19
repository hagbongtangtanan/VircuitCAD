import { create } from 'zustand'
import { appendSerialText, createSerialBuffer, type SerialBuffer } from './serialBuffer'

/** Buffer for the serial monitor, fed byte by byte from the emulated AVR's UART. */
export interface SerialStore {
  readonly buffer: SerialBuffer
  readonly baudRate: number
  appendText(text: string): void
  appendBytes(bytes: Uint8Array): void
  setBaudRate(baudRate: number): void
  clear(): void
}

const decoder = new TextDecoder()

export const useSerialStore = create<SerialStore>()((set, get) => ({
  buffer: createSerialBuffer(),
  baudRate: 9600,

  appendText(text: string): void {
    set({ buffer: appendSerialText(get().buffer, text) })
  },

  appendBytes(bytes: Uint8Array): void {
    set({ buffer: appendSerialText(get().buffer, decoder.decode(bytes)) })
  },

  setBaudRate(baudRate: number): void {
    set({ baudRate })
  },

  clear(): void {
    set({ buffer: createSerialBuffer() })
  },
}))
