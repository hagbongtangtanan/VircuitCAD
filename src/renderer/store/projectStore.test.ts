import { beforeEach, describe, expect, it, vi } from 'vitest'
import { starterById } from '../../starters/catalog'
import { useCircuitStore } from './circuitStore'
import { useNotificationStore } from './notificationStore'
import { useProjectStore } from './projectStore'

const saveProject = vi.fn()
const openFile = vi.fn()

beforeEach(() => {
  saveProject.mockReset()
  useNotificationStore.getState().clear()
  openFile.mockReset()
  ;(globalThis as unknown as { window: unknown }).window = { api: { saveProject, openFile } }
  useProjectStore.getState().newProject()
})

describe('project save', () => {
  it('keeps the current title and reports the saved file', async () => {
    saveProject.mockResolvedValue({ path: '/tmp/My Board.vcc' })

    useProjectStore.getState().rename('My Board')
    await useProjectStore.getState().save()

    expect(saveProject).toHaveBeenCalledTimes(1)
    expect(saveProject.mock.calls[0]?.[0]).toMatchObject({
      project: { name: 'My Board' },
      path: null,
    })
    expect(useProjectStore.getState()).toMatchObject({
      name: 'My Board',
      path: '/tmp/My Board.vcc',
      dirty: false,
      error: null,
    })
    expect(useNotificationStore.getState().items.at(-1)).toMatchObject({
      tone: 'success',
      title: 'Project saved',
      message: 'Saved as My Board.vcc',
    })
  })

  it('keeps the title and stays dirty when the dialog is cancelled', async () => {
    saveProject.mockResolvedValue(null)

    useProjectStore.getState().rename('My Board')
    await useProjectStore.getState().save()

    expect(useProjectStore.getState()).toMatchObject({
      name: 'My Board',
      path: null,
      dirty: true,
      error: null,
    })
    expect(useNotificationStore.getState().items).toHaveLength(0)
  })

  it('reports a failed save without losing the title', async () => {
    saveProject.mockRejectedValue(new Error('disk is full'))

    useProjectStore.getState().rename('My Board')
    await useProjectStore.getState().save()

    expect(useProjectStore.getState()).toMatchObject({
      name: 'My Board',
      dirty: true,
      error: 'disk is full',
    })
    expect(useNotificationStore.getState().items.at(-1)).toMatchObject({
      tone: 'error',
      title: 'Could not save project',
      message: 'disk is full',
    })
  })
})
describe('starter and legacy projects', () => {
  it('loads a bundled starter as a read-only template', () => {
    const starter = starterById('uno-blink')
    if (starter === undefined) throw new Error('starter is missing')
    useProjectStore.getState().loadStarter(starter)

    expect(useProjectStore.getState()).toMatchObject({
      name: 'Blink an LED',
      path: null,
      dirty: false,
      error: null,
    })
    expect(useCircuitStore.getState().document.parts).toHaveLength(3)
    expect(useNotificationStore.getState().items.at(-1)).toMatchObject({
      tone: 'success',
      title: 'Project opened',
    })
  })

  it('opens a legacy v1 project and gives it a fresh creation timestamp', async () => {
    openFile.mockResolvedValue({
      kind: 'project',
      path: '/tmp/legacy.vircuit',
      project: {
        format: 'vircuit-project',
        version: 1,
        name: 'Legacy board',
        circuit: { version: 1, parts: [], wires: [] },
        sketch: 'void setup() {}\n',
      },
    })

    await useProjectStore.getState().open()

    const state = useProjectStore.getState()
    expect(state.name).toBe('Legacy board')
    expect(state.path).toBe('/tmp/legacy.vircuit')
    expect(state.createdAt).not.toBeNull()
    expect(state.dirty).toBe(false)
  })
})
