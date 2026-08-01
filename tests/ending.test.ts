import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { checkCollapse, evaluate } from '../src/game/ending'
import type { GameState } from '../src/game/types'

const base = (): GameState => createInitialState(4)

describe('ending', () => {
  it('士気が0以下で崩壊', () => {
    const s: GameState = { ...base(), resources: { ...base().resources, morale: 0 } }
    expect(checkCollapse(s)).toBe(true)
  })

  it('犠牲が閾値以上で崩壊', () => {
    const s: GameState = { ...base(), flags: { ...base().flags, casualties: 30 } }
    expect(checkCollapse(s)).toBe(true)
  })

  it('インフラ復旧・少犠牲なら完全復旧', () => {
    const s: GameState = {
      ...base(),
      resources: { ...base().resources, power: 70, medical: 70 },
      flags: { ...base().flags, casualties: 2 },
    }
    expect(evaluate(s)).toBe('full_recovery')
  })

  it('犠牲が大きければ管理された犠牲', () => {
    const s: GameState = {
      ...base(),
      resources: { ...base().resources, power: 70, medical: 70 },
      flags: { ...base().flags, casualties: 15 },
    }
    expect(evaluate(s)).toBe('managed_sacrifice')
  })

  it('インフラ未復旧で協力度高ければ住民自治', () => {
    const s: GameState = {
      ...base(),
      resources: { ...base().resources, power: 30, medical: 30 },
      flags: { ...base().flags, casualties: 1, cooperation: 20 },
    }
    expect(evaluate(s)).toBe('self_governance')
  })
})
