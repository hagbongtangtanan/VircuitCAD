import { create } from 'zustand'
import { APP_NAME, DEFAULT_PROJECT_NAME } from '../../shared/app'
import { emptyCircuitDocument, type CircuitDocument } from '../../shared/circuit'
import {
  createProject,
  fileBaseName,
  sampleLabel,
  type OpenFileResult,
  type SampleEntry,
} from '../../shared/project'
import { useSerialStore } from '../serial/serialStore'
import { useCircuitStore } from './circuitStore'
import { useSimStore } from './simStore'
import { DEFAULT_SKETCH, useSketchStore } from './sketchStore'

export interface ProjectStore {
  /** Absolute path of the last save/open, null until the project has a home. */
  readonly path: string | null
  readonly name: string
  readonly dirty: boolean
  readonly busy: boolean
  readonly error: string | null
  readonly samples: readonly SampleEntry[]

  open(): Promise<void>
  loadSamples(): Promise<void>
  openSample(name: string): Promise<void>
  newProject(): void
  rename(name: string): void
  save(): Promise<void>
  exportSketch(): Promise<void>
  exportHex(): Promise<void>
  dismissError(): void
}

/**
 * Snapshots of what is on disk. Comparing the live stores against these is
 * cheaper and more reliable than tracking every individual edit action.
 */
let savedCircuit: CircuitDocument = useCircuitStore.getState().document
let savedSource: string = useSketchStore.getState().source

function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
}

export function updateWindowTitle(name: string, dirty: boolean): void {
  if (typeof document === 'undefined') return
  document.title = `${dirty ? '• ' : ''}${name} — ${APP_NAME}`
}

export const useProjectStore = create<ProjectStore>()((set, get) => {
  function markSaved(name: string): void {
    savedCircuit = useCircuitStore.getState().document
    savedSource = useSketchStore.getState().source
    set({ name, dirty: false })
    updateWindowTitle(name, false)
  }

  function applyOpened(opened: OpenFileResult, label?: string): void {
    useSimStore.getState().stop()
    if (opened.kind === 'project') {
      useCircuitStore.getState().replaceDocument(opened.project.circuit)
      useSketchStore.getState().setSource(opened.project.sketch)
      useSketchStore.getState().clearBuild()
      set({ path: opened.path })
      markSaved(label ?? fileBaseName(opened.path))
    } else {
      useSketchStore.getState().setSource(opened.sketch)
      useSketchStore.getState().clearBuild()
      set({ path: null })
      markSaved(label ?? fileBaseName(opened.path))
    }
  }

  function resetAll(): void {
    useSimStore.getState().stop()
    useSerialStore.getState().clear()
    useCircuitStore.getState().replaceDocument(emptyCircuitDocument())
    useSketchStore.getState().setSource(DEFAULT_SKETCH)
    useSketchStore.getState().clearBuild()
  }

  return {
    path: null,
    name: DEFAULT_PROJECT_NAME,
    dirty: false,
    busy: false,
    error: null,
    samples: [],

    async open(): Promise<void> {
      if (get().busy) return
      set({ busy: true, error: null })
      try {
        const opened = await window.api.openFile()
        if (opened === null) return

        applyOpened(opened)
        set({ error: null })
      } catch (error) {
        set({ error: errorMessage(error) })
      } finally {
        set({ busy: false })
      }
    },

    async loadSamples(): Promise<void> {
      try {
        set({ samples: await window.api.listSamples() })
      } catch {
        // Samples are optional; a missing folder is not worth an error banner.
      }
    },

    async openSample(name: string): Promise<void> {
      if (get().busy) return
      set({ busy: true, error: null })
      try {
        applyOpened(await window.api.openSample({ name }), sampleLabel(name))
        // The sample file itself is read-only: saving asks for a new location.
        set({ path: null })
      } catch (error) {
        set({ error: errorMessage(error) })
      } finally {
        set({ busy: false })
      }
    },

    newProject(): void {
      resetAll()
      set({ path: null, error: null })
      markSaved(DEFAULT_PROJECT_NAME)
    },

    rename(name: string): void {
      const trimmed = name.trim()
      const next = trimmed === '' ? DEFAULT_PROJECT_NAME : trimmed
      if (next === get().name) return
      // A different name means the document no longer matches what is on disk.
      set({ name: next, dirty: true })
      updateWindowTitle(next, true)
    },

    async save(): Promise<void> {
      if (get().busy) return
      set({ busy: true, error: null })
      try {
        const project = createProject({
          circuit: useCircuitStore.getState().document,
          sketch: useSketchStore.getState().source,
        })
        const saved = await window.api.saveProject({ project, path: get().path })
        if (saved === null) return

        set({ path: saved.path })
        markSaved(fileBaseName(saved.path))
        set({ error: null })
      } catch (error) {
        set({ error: errorMessage(error) })
      } finally {
        set({ busy: false })
      }
    },

    async exportSketch(): Promise<void> {
      set({ error: null })
      try {
        await window.api.exportSketch({ sketch: useSketchStore.getState().source, path: null })
      } catch (error) {
        set({ error: errorMessage(error) })
      }
    },

    async exportHex(): Promise<void> {
      const hex = useSketchStore.getState().hex
      if (hex === null) {
        set({ error: 'Build the sketch before exporting HEX.' })
        return
      }
      set({ error: null })
      try {
        await window.api.exportHex({ hex, path: null })
      } catch (error) {
        set({ error: errorMessage(error) })
      }
    },

    dismissError(): void {
      set({ error: null })
    },
  }
})

useCircuitStore.subscribe((state, previous) => {
  if (state.document === previous.document) return
  const dirty = state.document !== savedCircuit
  if (dirty !== useProjectStore.getState().dirty) {
    useProjectStore.setState({ dirty })
    updateWindowTitle(useProjectStore.getState().name, dirty)
  }
})

useSketchStore.subscribe((state, previous) => {
  if (state.source === previous.source) return
  const dirty = state.source !== savedSource
  if (dirty !== useProjectStore.getState().dirty) {
    useProjectStore.setState({ dirty })
    updateWindowTitle(useProjectStore.getState().name, dirty)
  }
})
