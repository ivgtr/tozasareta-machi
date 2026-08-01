import { describe, expect, it } from 'vitest'
import { chance, nextRandom, weightedPick } from '../src/game/rng'
import type { RngState } from '../src/game/types'

const rng0: RngState = { seed: 12345, counter: 0 }

describe('rng', () => {
  it('同じ seed なら同じ列を返す（決定性）', () => {
    const [a] = nextRandom(rng0)
    const [b] = nextRandom(rng0)
    expect(a).toBe(b)
  })

  it('値は [0,1) の範囲', () => {
    let r = rng0
    for (let i = 0; i < 100; i++) {
      const [v, next] = nextRandom(r)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
      r = next
    }
  })

  it('counter が進むと値が変わる', () => {
    const [a, r1] = nextRandom(rng0)
    const [b] = nextRandom(r1)
    expect(a).not.toBe(b)
  })

  it('chance は p=0 で必ず false、p=1 で必ず true', () => {
    const [f] = chance(rng0, 0)
    const [t] = chance(rng0, 1)
    expect(f).toBe(false)
    expect(t).toBe(true)
  })

  it('weightedPick は重み0の要素を選ばない', () => {
    const items = ['zero', 'one'] as const
    let r = rng0
    for (let i = 0; i < 20; i++) {
      const picked = weightedPick(items, (x) => (x === 'zero' ? 0 : 1), r)
      expect(picked).not.toBeNull()
      if (picked) {
        expect(picked[0]).toBe('one')
        r = picked[1]
      }
    }
  })

  it('weightedPick は全重み0で null', () => {
    expect(weightedPick(['a'], () => 0, rng0)).toBeNull()
    expect(weightedPick([], () => 1, rng0)).toBeNull()
  })
})
