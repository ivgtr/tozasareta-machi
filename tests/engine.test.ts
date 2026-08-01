import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { step } from '../src/game/engine'
import { preview } from '../src/game/actions'
import { BALANCE } from '../src/game/data/balance'
import type { DayPlan, GameState } from '../src/game/types'

const steadyPlan: DayPlan = {
  assignments: [
    { task: 'restore_road', workers: 2 },
    { task: 'repair_power', workers: 1, characterId: 'engineer' },
    { task: 'reinforce_medical', workers: 1, characterId: 'medic' },
  ],
}

function play(seed: number, planFor: (s: GameState) => DayPlan): GameState {
  let s = createInitialState(seed)
  let guard = 0
  while (s.phase === 'planning' && guard++ < 40) {
    s = step(s, { type: 'commitDay', plan: planFor(s) }).state
  }
  return s
}

describe('engine', () => {
  it('commitDay で日が進み report が埋まる', () => {
    const s0 = createInitialState(9)
    const { state, effects } = step(s0, { type: 'commitDay', plan: steadyPlan })
    expect(state.day).toBe(2)
    expect(effects.length).toBeGreaterThan(0)
    expect(state.report).toEqual(effects)
  })

  it('同じ seed・同じ行動なら同一結果（決定性）', () => {
    const a = play(777, () => steadyPlan)
    const b = play(777, () => steadyPlan)
    expect(a).toEqual(b)
  })

  it('30日で終了し、いずれかのエンディングに到達する', () => {
    const s = play(42, () => steadyPlan)
    expect(s.phase).toBe('ended')
    expect(s.ending).toBeDefined()
    expect(s.day).toBeLessThanOrEqual(BALANCE.days + 1)
  })

  it('終了後の step は状態を変えない', () => {
    const s = play(42, () => steadyPlan)
    const after = step(s, { type: 'commitDay', plan: steadyPlan })
    expect(after.state).toBe(s)
    expect(after.effects).toHaveLength(0)
  })

  it('preview は実際の任務フェーズの効果と一致する', () => {
    const s0 = createInitialState(5)
    const plan: DayPlan = {
      assignments: [
        { task: 'repair_power', workers: 1, characterId: 'engineer' },
        { task: 'restore_road', workers: 2 },
        { task: 'ration', workers: 0 },
      ],
    }
    const pv = preview(s0, plan).filter((e) => e.source !== 'task:ration')
    const applied = step(s0, { type: 'commitDay', plan }).effects.filter(
      (e) => e.source.startsWith('task:') && e.source !== 'task:ration',
    )
    const key = (e: { source: string; target: string; delta: number }) =>
      `${e.source}|${e.target}|${e.delta}`
    expect(pv.map(key).sort()).toEqual(applied.map(key).sort())
  })
})
