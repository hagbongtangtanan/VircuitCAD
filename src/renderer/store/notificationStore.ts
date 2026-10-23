import { create } from 'zustand'

export type NotificationTone = 'success' | 'info' | 'warning' | 'error'

export interface AppNotification {
  readonly id: string
  readonly tone: NotificationTone
  readonly title: string
  readonly message?: string
}

interface NotifyInput {
  readonly tone?: NotificationTone
  readonly title: string
  readonly message?: string
}

export interface NotificationStore {
  readonly items: readonly AppNotification[]
  notify(input: NotifyInput): string
  dismiss(id: string): void
  clear(): void
}

const AUTO_DISMISS_MS: Readonly<Record<NotificationTone, number>> = {
  success: 4200,
  info: 5200,
  warning: 7000,
  error: 9000,
}
const MAX_VISIBLE = 4

let nextId = 1
const timers = new Map<string, ReturnType<typeof setTimeout>>()

function clearTimer(id: string): void {
  const timer = timers.get(id)
  if (timer === undefined) return
  clearTimeout(timer)
  timers.delete(id)
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  items: [],

  notify(input: NotifyInput): string {
    const tone = input.tone ?? 'info'
    const id = `notice-${nextId}`
    nextId += 1
    const notification: AppNotification = {
      id,
      tone,
      title: input.title,
      ...(input.message === undefined ? {} : { message: input.message }),
    }

    const current = get().items
    const overflow = current.length + 1 - MAX_VISIBLE
    if (overflow > 0) {
      for (const old of current.slice(0, overflow)) clearTimer(old.id)
    }
    set({ items: [...current.slice(Math.max(0, overflow)), notification] })

    const timer = setTimeout(() => {
      timers.delete(id)
      set({ items: get().items.filter((item) => item.id !== id) })
    }, AUTO_DISMISS_MS[tone])
    timers.set(id, timer)
    return id
  },

  dismiss(id: string): void {
    clearTimer(id)
    set({ items: get().items.filter((item) => item.id !== id) })
  },

  clear(): void {
    for (const id of timers.keys()) clearTimer(id)
    set({ items: [] })
  },
}))
