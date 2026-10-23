import { create } from 'zustand'
import { APP_NAME, DEFAULT_PROJECT_NAME, normalizeProjectName } from '../../shared/app'
import { emptyCircuitDocument, type CircuitDocument } from '../../shared/circuit'
import {
  createProject,
  fileBaseName,
  fileStem,
  sampleLabel,
  type OpenFileResult,
  type SampleEntry,
} from '../../shared/project'
import { captureActiveSchematicPdf } from '../export/pdfCapture'
import { captureActiveViewPng } from '../export/pngCapture'
import { useSerialStore } from '../serial/serialStore'
import { useCircuitStore } from './circuitStore'
import { useNotificationStore } from './notificationStore'
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
  /** Loads a project/sketch passed to the app by the OS. */
  openLaunch(): Promise<void>
  /** Receives a file opened by the OS while the app is running. */
  receiveOpened(opened: OpenFileResult): void
  reportError(message: string): void
  loadSamples(): Promise<void>
  openSample(name: string): Promise<void>
  newProject(): void
  rename(name: string): void
  save(): Promise<void>
  exportSketch(): Promise<void>
  exportHex(): Promise<void>
  exportPng(): Promise<void>
  exportPdf(): Promise<void>
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
      const name = normalizeProjectName(label ?? opened.project.name ?? fileStem(opened.path))
      markSaved(name)
      notify('success', 'Project opened', name)
    } else {
      useSketchStore.getState().setSource(opened.sketch)
      useSketchStore.getState().clearBuild()
      set({ path: null })
      const name = normalizeProjectName(label ?? fileStem(opened.path))
      markSaved(name)
      notify('success', 'Sketch opened', name)
    }
  }

  function resetAll(): void {
    useSimStore.getState().stop()
    useSerialStore.getState().clear()
    useCircuitStore.getState().replaceDocument(emptyCircuitDocument())
    useSketchStore.getState().setSource(DEFAULT_SKETCH)
    useSketchStore.getState().clearBuild()
  }

  function notify(
    tone: 'success' | 'info' | 'warning' | 'error',
    title: string,
    message?: string
  ): void {
    useNotificationStore.getState().notify({ tone, title, message })
  }

  function fail(title: string, error: unknown): void {
    const message = errorMessage(error)
    set({ error: message })
    notify('error', title, message)
  }

  function warn(title: string, message: string): void {
    set({ error: message })
    notify('warning', title, message)
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
        fail('Could not open file', error)
      } finally {
        set({ busy: false })
      }
    },

    async openLaunch(): Promise<void> {
      if (get().busy) return
      set({ busy: true })
      try {
        const opened = await window.api.takeLaunchFile()
        if (opened !== null) applyOpened(opened)
      } catch (error) {
        fail('Could not open file', error)
      } finally {
        set({ busy: false })
      }
    },

    receiveOpened(opened: OpenFileResult): void {
      try {
        applyOpened(opened)
        set({ error: null })
      } catch (error) {
        fail('Could not open file', error)
      }
    },

    reportError(message: string): void {
      set({ error: message })
      notify('error', 'Could not open file', message)
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
        fail('Could not open sample', error)
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
      const next = normalizeProjectName(name)
      if (next === get().name) return
      // A different name means the document no longer matches what is on disk.
      set({ name: next, dirty: true })
      updateWindowTitle(next, true)
    },

    async save(): Promise<void> {
      if (get().busy) return
      set({ busy: true, error: null })
      try {
        const name = get().name
        const project = createProject({
          name,
          circuit: useCircuitStore.getState().document,
          sketch: useSketchStore.getState().source,
        })
        const saved = await window.api.saveProject({ project, path: get().path })
        if (saved === null) return

        set({ path: saved.path })
        markSaved(name)
        set({ error: null })
        notify('success', 'Project saved', `Saved as ${fileBaseName(saved.path)}`)
      } catch (error) {
        fail('Could not save project', error)
      } finally {
        set({ busy: false })
      }
    },

    async exportSketch(): Promise<void> {
      set({ error: null })
      try {
        const saved = await window.api.exportSketch({
          sketch: useSketchStore.getState().source,
          path: null,
        })
        if (saved !== null) notify('success', 'Sketch exported', fileBaseName(saved.path))
      } catch (error) {
        fail('Could not export sketch', error)
      }
    },

    async exportPng(): Promise<void> {
      set({ error: null })
      try {
        const dataUrl = await captureActiveViewPng()
        if (dataUrl === null) {
          warn('Nothing to export', 'There is nothing to export yet.')
          return
        }
        const saved = await window.api.exportPng({ dataUrl, name: get().name, path: null })
        if (saved !== null) notify('success', 'View exported', fileBaseName(saved.path))
      } catch (error) {
        fail('Could not export view', error)
      }
    },

    async exportPdf(): Promise<void> {
      set({ error: null })
      try {
        const data = await captureActiveSchematicPdf()
        if (data === null) {
          warn(
            'Schematic PDF unavailable',
            'Switch to Schematic in Original style to save a vector PDF.'
          )
          return
        }
        const saved = await window.api.exportPdf({ data, name: get().name, path: null })
        if (saved !== null) notify('success', 'Schematic exported', fileBaseName(saved.path))
      } catch (error) {
        fail('Could not export schematic', error)
      }
    },

    async exportHex(): Promise<void> {
      const hex = useSketchStore.getState().hex
      if (hex === null) {
        warn('No program to export', 'Build the sketch before exporting HEX.')
        return
      }
      set({ error: null })
      try {
        const saved = await window.api.exportHex({ hex, path: null })
        if (saved !== null) notify('success', 'Program exported', fileBaseName(saved.path))
      } catch (error) {
        fail('Could not export program', error)
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
