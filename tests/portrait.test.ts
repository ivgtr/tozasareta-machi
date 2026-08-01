import { describe, expect, it } from 'vitest'
import {
  RANDOM_PORTRAIT_IDS,
  UNIQUE_UNITS,
  makeRandomUnit,
  selectRandomPortrait,
} from '../src/game/data/units'
import type { RngState } from '../src/game/types'
import { artSpec } from '../src/ui/art/manifest'

describe('unique unit portraits', () => {
  it('30体のID・名前・肖像IDが重複しない', () => {
    expect(UNIQUE_UNITS).toHaveLength(30)
    expect(new Set(UNIQUE_UNITS.map((unit) => unit.id)).size).toBe(30)
    expect(new Set(UNIQUE_UNITS.map((unit) => unit.name)).size).toBe(30)
    expect(new Set(UNIQUE_UNITS.map((unit) => unit.portrait)).size).toBe(30)
  })

  it('全ユニークの肖像スロットとフレーバーが定義されている', () => {
    for (const unit of UNIQUE_UNITS) {
      expect(artSpec('portrait', unit.portrait)?.label).toBe(unit.name)
      expect(unit.flavor).toBeTruthy()
    }
  })
})

describe('selectRandomPortrait', () => {
  it('同一入力で同一IDを返す（決定性）', () => {
    const a = selectRandomPortrait(42, 'recruit_5', [])
    const b = selectRandomPortrait(42, 'recruit_5', [])
    expect(a).toBe(b)
  })

  it('返値は必ず RANDOM_PORTRAIT_IDS に含まれる', () => {
    for (let seed = 0; seed < 100; seed++) {
      const id = selectRandomPortrait(seed, `recruit_${seed}`, [])
      expect(RANDOM_PORTRAIT_IDS).toContain(id)
    }
  })

  it('未使用候補がある間は使用中IDを返さない', () => {
    const used = RANDOM_PORTRAIT_IDS.slice(0, 6)
    for (let seed = 0; seed < 100; seed++) {
      const id = selectRandomPortrait(seed, `recruit_${seed}`, used)
      expect(used).not.toContain(id)
    }
  })

  it('8枚すべて使用中でも有効なIDを返す', () => {
    for (let seed = 0; seed < 50; seed++) {
      const id = selectRandomPortrait(seed, `recruit_${seed}`, [...RANDOM_PORTRAIT_IDS])
      expect(RANDOM_PORTRAIT_IDS).toContain(id)
    }
  })

  it('unitId が異なれば異なるIDになりうる', () => {
    const results = new Set<string>()
    for (let i = 0; i < 20; i++) {
      results.add(selectRandomPortrait(42, `recruit_${i}`, []))
    }
    expect(results.size).toBeGreaterThan(1)
  })
})

describe('makeRandomUnit portrait', () => {
  const rng: RngState = { seed: 1, counter: 10 }

  it('portrait が RANDOM_PORTRAIT_IDS のいずれかになる', () => {
    const { unit } = makeRandomUnit(rng, [], [])
    expect(RANDOM_PORTRAIT_IDS).toContain(unit.portrait)
  })

  it('動的な recruit_<counter> を portrait に使わない', () => {
    const { unit } = makeRandomUnit(rng, [], [])
    expect(unit.portrait).not.toMatch(/^recruit_\d+$/)
  })

  it('usedPortraits を渡すと重複を避ける', () => {
    const used = RANDOM_PORTRAIT_IDS.slice(0, 7)
    for (let counter = 0; counter < 20; counter++) {
      const { unit } = makeRandomUnit({ seed: 1, counter }, [], used)
      expect(used).not.toContain(unit.portrait)
    }
  })

  it('portrait 選択は RngState.counter を進めない', () => {
    const r: RngState = { seed: 99, counter: 0 }
    const { rng: after } = makeRandomUnit(r, [], [])
    const { rng: afterWithUsed } = makeRandomUnit(r, [], RANDOM_PORTRAIT_IDS.slice(0, 4))
    expect(after.counter).toBe(afterWithUsed.counter)
  })

  it('同じ seed+counter で同じ portrait（決定性）', () => {
    const a = makeRandomUnit({ seed: 7, counter: 3 }, [], [])
    const b = makeRandomUnit({ seed: 7, counter: 3 }, [], [])
    expect(a.unit.portrait).toBe(b.unit.portrait)
  })
})
