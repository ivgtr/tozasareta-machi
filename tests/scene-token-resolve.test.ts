import { describe, expect, it } from 'vitest'
import { GENERIC_POOL, recruitFallbackOf, resolveToken } from '../src/scene/town/token-resolve'

describe('recruitFallbackOf', () => {
  it('決定的でプール内IDを返す', () => {
    const a = recruitFallbackOf('masamune')
    const b = recruitFallbackOf('masamune')
    expect(a).toBe(b)
    expect(GENERIC_POOL).toContain(a)
    expect(GENERIC_POOL).toHaveLength(8)
  })
})

describe('resolveToken', () => {
  const none = () => false

  it('トークン未着はグリフへフォールバック', () => {
    const r = resolveToken('masamune', none)
    expect(r.kind).toBe('glyph')
    expect(r.key).toBeNull()
    expect(GENERIC_POOL).toContain(r.fallbackPortrait ?? '')
  })

  it('個別トークンがあればそれを解決する', () => {
    const r = resolveToken('mayor', (k) => k === 'token/mayor')
    expect(r).toEqual({ kind: 'token', key: 'token/mayor', fallbackPortrait: null })
  })

  it('ユニークは汎用プール経由で解決する', () => {
    const fallback = recruitFallbackOf('masamune')
    const r = resolveToken('masamune', (k) => k === `token/${fallback}`)
    expect(r.kind).toBe('token')
    expect(r.key).toBe(`token/${fallback}`)
  })

  it('汎用プールID自体は個別解決を試み、未着ならグリフ', () => {
    const r = resolveToken('recruit_workwear_a', none)
    expect(r.kind).toBe('glyph')
    expect(r.fallbackPortrait).toBe('recruit_workwear_a')
  })
})
