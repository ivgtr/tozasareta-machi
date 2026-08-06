import { RANDOM_PORTRAIT_IDS, selectRandomPortrait } from '../../game/data/units'

export const GENERIC_POOL: readonly string[] = RANDOM_PORTRAIT_IDS

const FALLBACK_SEED = 0

export function recruitFallbackOf(portraitId: string): string {
  return selectRandomPortrait(FALLBACK_SEED, portraitId, [])
}

export interface TokenResolution {
  kind: 'token' | 'glyph'
  key: string | null
  fallbackPortrait: string | null
}

export function resolveToken(
  portraitId: string,
  hasTexture: (key: string) => boolean,
): TokenResolution {
  const own = `token/${portraitId}`
  if (hasTexture(own)) return { kind: 'token', key: own, fallbackPortrait: null }
  const portraitKey = `portrait/${portraitId}`
  if (hasTexture(portraitKey)) return { kind: 'token', key: portraitKey, fallbackPortrait: null }
  if (GENERIC_POOL.includes(portraitId)) {
    return { kind: 'glyph', key: null, fallbackPortrait: portraitId }
  }
  const fallback = recruitFallbackOf(portraitId)
  const fallbackKey = `token/${fallback}`
  if (hasTexture(fallbackKey))
    return { kind: 'token', key: fallbackKey, fallbackPortrait: fallback }
  return { kind: 'glyph', key: null, fallbackPortrait: fallback }
}
