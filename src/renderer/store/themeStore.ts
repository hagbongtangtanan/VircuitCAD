import { create } from 'zustand'

export type Theme = 'dark' | 'light'

export const THEME_STORAGE_KEY = 'vircuitcad.theme'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readTheme(storage: StorageLike | null = browserStorage()): Theme {
  if (storage === null) return 'dark'
  try {
    return storage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme, storage: StorageLike | null = browserStorage()): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme
  }
  if (storage === null) return
  try {
    storage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // A locked-down storage area should not break theme switching.
  }
}

export interface ThemeStore {
  readonly theme: Theme
  setTheme(theme: Theme): void
  toggle(): void
}

export const useThemeStore = create<ThemeStore>()((set, get) => ({
  theme: readTheme(),
  setTheme(theme: Theme): void {
    applyTheme(theme)
    set({ theme })
  },
  toggle(): void {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark')
  },
}))

export function applyStoredTheme(): void {
  applyTheme(readTheme())
}
