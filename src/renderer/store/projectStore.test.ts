import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotificationStore } from './notificationStore'
import { useProjectStore } from './projectStore'

const saveProject = vi.fn()

beforeEach(() => {
  saveProject.mockReset()
  useNotificationStore.getState().clear()
  ;(globalThis as unknown as { window: unknown }).window = { api: { saveProject } }
  useProjectStore.getState().newProject()
})

describe('project save', () => {
  it('keeps the current title and reports the saved file', async () => {
    saveProject.mockResolvedValue({ path: '/tmp/My Board.hucad' })

    useProjectStore.getState().rename('My Board')
    await useProjectStore.getState().save()

    expect(saveProject).toHaveBeenCalledTimes(1)
    expect(saveProject.mock.calls[0]?.[0]).toMatchObject({
      project: { name: 'My Board' },
      path: null,
    })
    expect(useProjectStore.getState()).toMatchObject({
      name: 'My Board',
      path: '/tmp/My Board.hucad',
      dirty: false,
      error: null,
    })
    expect(useNotificationStore.getState().items.at(-1)).toMatchObject({
      tone: 'success',
      title: 'Project saved',
      message: 'Saved as My Board.hucad',
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
