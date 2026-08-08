export const DEATH_SOURCES = {
  starvation: 'death:starvation',
  expedition: 'death:expedition',
} as const

export type DeathCause = keyof typeof DEATH_SOURCES

export function deathCauseFromSource(source: string): DeathCause | null {
  if (source === DEATH_SOURCES.starvation) return 'starvation'
  if (source === DEATH_SOURCES.expedition) return 'expedition'
  return null
}
