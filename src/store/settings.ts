export interface Settings {
  animations: boolean
}

const KEY = 'tozasareta-machi:settings'
const DEFAULT: Settings = { animations: true }

function loadSettings(): Settings {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    return DEFAULT
  }
  return DEFAULT
}

let current: Settings = loadSettings()
const listeners = new Set<() => void>()

export function getSettings(): Settings {
  return current
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch }
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    /* 無視 */
  }
  listeners.forEach((l) => l())
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function reducedMotion(): boolean {
  const systemPrefersReduce =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  return systemPrefersReduce || !getSettings().animations
}
