import { create } from 'zustand'
import { CLOCK_HZ, ArduinoSimulation, type SimulationFrame } from '../sim/simulation'
import { useSerialStore } from '../serial/serialStore'
import { useCircuitStore } from './circuitStore'
import { currentSolveOptions } from './interactionStore'
import { useSketchStore } from './sketchStore'

export type SimulationStatus = 'idle' | 'preparing' | 'running' | 'stopped' | 'error'

export interface SimStore {
  readonly status: SimulationStatus
  readonly error: string | null
  readonly elapsedMs: number
  /** 0 to 1 per LED part id. */
  readonly ledBrightness: Readonly<Record<string, number>>
  /** 0 to 1 rotor speed per DC motor part id. */
  readonly motorSpeed: Readonly<Record<string, number>>
  readonly pinVoltages: Readonly<Record<string, number | null>>
  readonly failedParts: Readonly<Record<string, boolean>>

  start(): Promise<void>
  stop(): void
  toggle(): Promise<void>
}

/**
 * The emulator must not fall behind wall-clock time when a frame stalls; cap
 * the simulated slice instead of trying to catch up and freezing the UI.
 */
const MAX_FRAME_SECONDS = 0.05
const PUBLISH_INTERVAL_MS = 66

let engine: ArduinoSimulation | null = null
let frameHandle: number | null = null
let lastFrameTime = 0
let lastPublishTime = 0
let lastBrightnessSignature = ''

function cancelLoop(): void {
  if (frameHandle !== null) {
    cancelAnimationFrame(frameHandle)
    frameHandle = null
  }
}

function brightnessRecord(frame: SimulationFrame): Record<string, number> {
  return Object.fromEntries(frame.ledBrightness)
}

let audioContext: AudioContext | null = null
const buzzers = new Map<string, { readonly oscillator: OscillatorNode; readonly gain: GainNode }>()

function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (audioContext === null) audioContext = new AudioContext()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

function updatePiezoAudio(currents: ReadonlyMap<string, number>): void {
  const context = audioContext
  if (context === null) return
  for (const partId of new Set([...buzzers.keys(), ...currents.keys()])) {
    const current = currents.get(partId) ?? 0
    if (current > 0.0005) {
      let entry = buzzers.get(partId)
      if (entry === undefined) {
        const oscillator = context.createOscillator()
        oscillator.type = 'square'
        oscillator.frequency.value = 1000
        const gain = context.createGain()
        gain.gain.value = 0
        oscillator.connect(gain).connect(context.destination)
        oscillator.start()
        entry = { oscillator, gain }
        buzzers.set(partId, entry)
      }
      entry.gain.gain.setTargetAtTime(Math.min(0.12, current * 2.4), context.currentTime, 0.02)
    } else {
      const entry = buzzers.get(partId)
      if (entry !== undefined) entry.gain.gain.setTargetAtTime(0, context.currentTime, 0.04)
    }
  }
}

function stopPiezoAudio(): void {
  if (audioContext !== null) {
    for (const entry of buzzers.values()) entry.gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.04)
  }
}


export const useSimStore = create<SimStore>()((set, get) => {
  function publish(frame: SimulationFrame, force = false): void {
    const now = performance.now()
    const brightness = brightnessRecord(frame)
    const failedParts = Object.fromEntries([...frame.failedParts].map((id) => [id, true]))
    const signature = [
      ...Object.entries(brightness).map(([partId, value]) => `${partId}:${value.toFixed(3)}`),
      ...Object.entries(frame.motorSpeed).map(
        ([partId, value]) => `motor:${partId}:${value.toFixed(3)}`
      ),
    ].join('|')
    if (
      !force &&
      now - lastPublishTime < PUBLISH_INTERVAL_MS &&
      signature === lastBrightnessSignature
    ) {
      return
    }
    lastPublishTime = now
    lastBrightnessSignature = signature
    set({
      elapsedMs: Math.round(frame.elapsedMs),
      ledBrightness: brightness,
      motorSpeed: Object.fromEntries(frame.motorSpeed),
      pinVoltages: Object.fromEntries(frame.pinVoltages),
      failedParts,
    })
  }

  function tick(now: number): void {
    const simulation = engine
    if (simulation === null) return

    const deltaSeconds = Math.min(MAX_FRAME_SECONDS, Math.max(0, (now - lastFrameTime) / 1000))
    lastFrameTime = now
    try {
      simulation.runForCycles(Math.round(deltaSeconds * CLOCK_HZ))
      const frame = simulation.frame()
      updatePiezoAudio(frame.buzzerCurrents)
      publish(frame)
    } catch (error) {
      cancelLoop()
      engine = null
      set({ status: 'error', error: String(error) })
      return
    }

    frameHandle = requestAnimationFrame(tick)
  }

  function stopEngine(): void {
    cancelLoop()
    engine = null
    lastBrightnessSignature = ''
    stopPiezoAudio()
  }

  return {
    status: 'idle',
    error: null,
    elapsedMs: 0,
    ledBrightness: {},
    motorSpeed: {},
    pinVoltages: {},
    failedParts: {},

    async start(): Promise<void> {
      if (get().status === 'running') return
      stopEngine()
      set({
        status: 'preparing',
        error: null,
        elapsedMs: 0,
        ledBrightness: {},
        motorSpeed: {},
        pinVoltages: {},
        failedParts: {},
      })

      const sketch = useSketchStore.getState()
      let hex = sketch.hex
      if (hex === null || sketch.lastBuiltSource !== sketch.source) {
        await sketch.build()
        hex = useSketchStore.getState().hex
      }
      if (hex === null) {
        const failure = useSketchStore.getState().buildError
        set({
          status: 'error',
          error: failure ?? 'The sketch did not compile. Check the build output.',
        })
        return
      }

      try {
        const simulation = new ArduinoSimulation(hex, useCircuitStore.getState().document)
        simulation.onSerialByte = (byte) => {
          useSerialStore.getState().appendBytes(Uint8Array.of(byte))
        }
        simulation.readInputs = currentSolveOptions
        simulation.prime()
        ensureAudio()
        engine = simulation
        lastFrameTime = performance.now()
        lastPublishTime = 0
        set({ status: 'running', error: null })
        frameHandle = requestAnimationFrame(tick)
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },

    stop(): void {
      if (get().status !== 'running' && get().status !== 'preparing') return
      stopEngine()
      set({ status: 'stopped', ledBrightness: {}, motorSpeed: {}, pinVoltages: {}, failedParts: {} })
    },

    async toggle(): Promise<void> {
      if (get().status === 'running' || get().status === 'preparing') get().stop()
      else await get().start()
    },
  }
})

// Circuit edits (moving parts, rewiring, inserting components) swap the
// netlist the emulator is holding without pausing the CPU, so the sketch keeps
// running against the new wiring.
useCircuitStore.subscribe((state, previous) => {
  if (state.document === previous.document) return
  const simulation = engine
  if (simulation !== null && useSimStore.getState().status === 'running') {
    simulation.updateDocument(state.document)
  }
})
