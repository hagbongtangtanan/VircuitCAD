import { create } from 'zustand'
import type { CompileResult, Diagnostic, MemoryUsage, ToolchainStatus } from '../../shared/schemas'

/**
 * The sketch and the result of building it. The compiled `.hex` is kept here so
 * the simulator (milestone 4) can start it without recompiling.
 */

export type BuildPhase = 'idle' | 'building' | 'succeeded' | 'failed'

export interface SketchStore {
  readonly source: string
  readonly phase: BuildPhase
  readonly diagnostics: readonly Diagnostic[]
  readonly memory: MemoryUsage | null
  readonly hex: string | null
  readonly durationMs: number | null
  readonly lastBuiltSource: string | null
  readonly toolchain: ToolchainStatus | null
  /** Set when a build could not even reach the compiler. */
  readonly buildError: string | null

  setSource(source: string): void
  build(): Promise<void>
  refreshToolchain(): Promise<void>
  clearBuild(): void
}

export const DEFAULT_SKETCH = `// VircuitCAD — Arduino sketch
int ledPin = 13;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  Serial.println("LED on");
  delay(500);
  digitalWrite(ledPin, LOW);
  Serial.println("LED off");
  delay(500);
}
`

export const useSketchStore = create<SketchStore>()((set, get) => ({
  source: DEFAULT_SKETCH,
  phase: 'idle',
  diagnostics: [],
  memory: null,
  hex: null,
  durationMs: null,
  lastBuiltSource: null,
  toolchain: null,
  buildError: null,

  setSource(source: string): void {
    set({ source })
  },

  async build(): Promise<void> {
    if (get().phase === 'building') return
    set({ phase: 'building', buildError: null })

    const source = get().source
    let result: CompileResult
    try {
      result = await window.api.compile({ sketch: source })
    } catch (error) {
      set({
        phase: 'failed',
        diagnostics: [],
        memory: null,
        hex: null,
        durationMs: null,
        buildError: error instanceof Error ? error.message : String(error),
      })
      return
    }

    set({
      phase: result.ok ? 'succeeded' : 'failed',
      diagnostics: [...result.diagnostics],
      memory: result.memory,
      hex: result.hex,
      durationMs: result.durationMs,
      lastBuiltSource: result.ok ? source : get().lastBuiltSource,
      buildError: null,
    })
  },

  async refreshToolchain(): Promise<void> {
    try {
      set({ toolchain: await window.api.toolchainStatus() })
    } catch (error) {
      set({
        toolchain: {
          available: false,
          detail: error instanceof Error ? error.message : String(error),
          avrGcc: null,
          arduinoCore: null,
        },
      })
    }
  },

  clearBuild(): void {
    set({
      phase: 'idle',
      diagnostics: [],
      memory: null,
      hex: null,
      durationMs: null,
      buildError: null,
    })
  },
}))
