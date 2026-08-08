import { RANDOM_PORTRAIT_IDS, selectRandomPortrait } from '../../game/data/units'

const INITIAL_TOKEN_IDS = ['mayor', 'medic', 'engineer', 'farmer'] as const

export const GENERIC_POOL: readonly string[] = RANDOM_PORTRAIT_IDS
export const TOKEN_ASSET_IDS: readonly string[] = [...INITIAL_TOKEN_IDS, ...GENERIC_POOL]

const DIRECT_TOKEN_IDS = new Set<string>(TOKEN_ASSET_IDS)
const FALLBACK_SEED = 0

export function recruitFallbackOf(portraitId: string): string {
  return selectRandomPortrait(FALLBACK_SEED, portraitId, [])
}

export function tokenAssetId(portraitId: string): string {
  return DIRECT_TOKEN_IDS.has(portraitId) ? portraitId : recruitFallbackOf(portraitId)
}

export function tokenTextureKey(portraitId: string): string {
  return `token/${tokenAssetId(portraitId)}`
}
