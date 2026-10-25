export const ONBOARDING_STORAGE_KEY = 'vircuitcad.onboarding.v1'

export type OnboardingStatus = 'completed' | 'skipped'

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): StorageLike | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/** True once the user has taken, skipped, or dismissed the orientation. */
export function hasSeenOnboarding(storage: StorageLike | null = browserStorage()): boolean {
  if (storage === null) return false
  try {
    return storage.getItem(ONBOARDING_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function markOnboardingSeen(
  status: OnboardingStatus = 'completed',
  storage: StorageLike | null = browserStorage()
): void {
  if (storage === null) return
  try {
    storage.setItem(ONBOARDING_STORAGE_KEY, status)
  } catch {
    // Storage can be unavailable in locked-down environments; the tour still works.
  }
}
