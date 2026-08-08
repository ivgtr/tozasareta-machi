import { describe, expect, it } from 'vitest'
import {
  GENERIC_POOL,
  TOKEN_ASSET_IDS,
  recruitFallbackOf,
  tokenAssetId,
  tokenTextureKey,
} from '../src/scene/town/token-resolve'

describe('recruitFallbackOf', () => {
  it('決定的で汎用トークンプール内IDを返す', () => {
    const first = recruitFallbackOf('masamune')
    const second = recruitFallbackOf('masamune')
    expect(first).toBe(second)
    expect(GENERIC_POOL).toContain(first)
    expect(GENERIC_POOL).toHaveLength(8)
  })
})

describe('tokenAssetId', () => {
  it('初期4体と汎用8体はportrait IDと同名の専用トークンを使う', () => {
    for (const id of ['mayor', 'medic', 'engineer', 'farmer', ...GENERIC_POOL]) {
      expect(tokenAssetId(id)).toBe(id)
    }
    expect(TOKEN_ASSET_IDS).toHaveLength(12)
  })

  it('ユニーク人物は決定的な汎用トークンへ解決する', () => {
    const resolved = tokenAssetId('masamune')
    expect(GENERIC_POOL).toContain(resolved)
    expect(resolved).toBe(recruitFallbackOf('masamune'))
  })

  it('texture keyはtoken名前空間へ一本化する', () => {
    expect(tokenTextureKey('mayor')).toBe('token/mayor')
    expect(tokenTextureKey('masamune')).toBe(`token/${recruitFallbackOf('masamune')}`)
  })
})
