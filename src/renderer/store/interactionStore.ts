import { create } from 'zustand'
import type { SolveOptions } from '../sim/solver'

/**
 * Transient user input (held buttons, latched switches, pot wipers) lives apart
 * from the circuit document: pressing a button must never mark the project
 * dirty or stop the running simulation.
 */
export interface InteractionStore {
  /** Part id to `true` while a momentary control is held down. */
  readonly pressed: Readonly<Record<string, boolean>>
  /** Latched state for toggle-style controls such as slide and DIP switches. */
  readonly switches: Readonly<Record<string, boolean>>
  /** Potentiometer wiper position, 0 to 1. */
  readonly pots: Readonly<Record<string, number>>
  /** Ambient level for sensors such as the photoresistor, 0 (dark) to 1 (bright). */
  readonly sensors: Readonly<Record<string, number>>
  /** Per-bit state for DIP switch banks. */
  readonly dipBits: Readonly<Record<string, readonly boolean[]>>
  /** Pressed key index (0-15) for matrix keypads. */
  readonly keypadKeys: Readonly<Record<string, number>>

  press(partId: string): void
  release(partId: string): void
  releaseAll(): void
  setSwitch(partId: string, on: boolean): void
  toggleSwitch(partId: string): void
  setPot(partId: string, value: number): void
  setSensor(partId: string, value: number): void
  setDipBit(partId: string, bit: number, on: boolean): void
  toggleDipBit(partId: string, bit: number): void
  setKeypadKey(partId: string, key: number | null): void
  reset(): void
}

export const useInteractionStore = create<InteractionStore>()((set, get) => ({
  pressed: {},
  switches: {},
  pots: {},
  sensors: {},
  dipBits: {},
  keypadKeys: {},

  press(partId: string): void {
    if (get().pressed[partId] === true) return
    set((state) => ({ pressed: { ...state.pressed, [partId]: true } }))
  },

  release(partId: string): void {
    if (get().pressed[partId] !== true) return
    set((state) => {
      const next = { ...state.pressed }
      delete next[partId]
      return { pressed: next }
    })
  },

  releaseAll(): void {
    if (Object.keys(get().pressed).length === 0) return
    set({ pressed: {} })
  },

  setSwitch(partId: string, on: boolean): void {
    set((state) => ({ switches: { ...state.switches, [partId]: on } }))
  },

  toggleSwitch(partId: string): void {
    const current = get().switches[partId] ?? false
    get().setSwitch(partId, !current)
  },

  setPot(partId: string, value: number): void {
    set((state) => ({
      pots: { ...state.pots, [partId]: Math.min(1, Math.max(0, value)) },
    }))
  },

  setSensor(partId: string, value: number): void {
    set((state) => ({
      sensors: { ...state.sensors, [partId]: Math.min(1, Math.max(0, value)) },
    }))
  },

  setDipBit(partId: string, bit: number, on: boolean): void {
    set((state) => {
      const current = state.dipBits[partId] ?? []
      const next = [...current]
      next[bit] = on
      return { dipBits: { ...state.dipBits, [partId]: next } }
    })
  },

  toggleDipBit(partId: string, bit: number): void {
    const bits = get().dipBits[partId] ?? []
    get().setDipBit(partId, bit, bits[bit] !== true)
  },

  setKeypadKey(partId: string, key: number | null): void {
    set((state) => {
      const next = { ...state.keypadKeys }
      if (key === null) delete next[partId]
      else next[partId] = key
      return { keypadKeys: next }
    })
  },

  reset(): void {
    set({ pressed: {}, switches: {}, pots: {}, sensors: {}, dipBits: {}, keypadKeys: {} })
  },
}))

/** Snapshot in the shape the solver expects; cheap enough to build per frame. */
export function currentSolveOptions(): SolveOptions {
  const { pressed, pots, switches, sensors, dipBits, keypadKeys } = useInteractionStore.getState()
  return {
    pressedParts: new Set(
      Object.entries(pressed)
        .filter(([, held]) => held)
        .map(([partId]) => partId)
    ),
    potPositions: new Map(Object.entries(pots).map(([partId, value]) => [partId, value] as const)),
    switchStates: new Map(
      Object.entries(switches).map(([partId, value]) => [partId, value] as const)
    ),
    sensorLevels: new Map(
      Object.entries(sensors).map(([partId, value]) => [partId, value] as const)
    ),
    dipBits: new Map(Object.entries(dipBits)),
    keypadKeys: new Map(Object.entries(keypadKeys)),
  }
}
