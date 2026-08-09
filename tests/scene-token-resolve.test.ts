import { INITIAL_UNITS, RANDOM_PORTRAIT_IDS, UNIQUE_UNITS } from '../src/game/data/units'
import { describe, expect, it } from 'vitest'
import { TOKEN_ASSET_IDS, tokenAssetId, tokenTextureKey } from '../src/scene/town/token-resolve'
import {
  hasTokenAppearance,
  TOKEN_APPEARANCE_BY_PORTRAIT,
} from '../src/scene/town/token-appearance'

describe('tokenAssetId', () => {
  it('現行portraitを4種の人型appearanceへ明示的に解決する', () => {
    const portraits = [
      ...INITIAL_UNITS.map((unit) => unit.portrait),
      ...RANDOM_PORTRAIT_IDS,
      ...UNIQUE_UNITS.map((unit) => unit.portrait),
    ]
    for (const portrait of portraits) expect(hasTokenAppearance(portrait)).toBe(true)
    expect(Object.keys(TOKEN_APPEARANCE_BY_PORTRAIT).sort()).toEqual([...new Set(portraits)].sort())
    expect(TOKEN_ASSET_IDS).toHaveLength(4)
  })

  it('未知portraitは単一の安全なfallbackへ解決する', () => {
    expect(tokenAssetId('unknown')).toBe('person_male_a')
  })

  it('texture keyはtoken名前空間へ一本化する', () => {
    expect(tokenTextureKey('mayor')).toBe('token/person_female_a')
    expect(tokenTextureKey('masamune')).toBe('token/person_male_b')
  })
})
