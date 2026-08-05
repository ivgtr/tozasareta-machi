import { useSyncExternalStore } from 'react'
import type { Settings } from '../store'
import { getSettings, subscribeSettings } from '../store'

export type { Settings } from '../store'
export { getSettings, reducedMotion, updateSettings } from '../store'

export function useSettings(): Settings {
  return useSyncExternalStore(subscribeSettings, getSettings)
}
