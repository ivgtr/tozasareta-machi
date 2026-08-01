import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { step } from '../src/game/engine'
import { autoAssign, preview } from '../src/game/actions'
import { BALANCE } from '../src/game/data/balance'
import type { DayPlan, GameState } from '../src/game/types'

const idle: DayPlan = { placements: [], ration: false }

function play(seed: number, planFor: (s: GameState) => DayPlan): GameState {
  let s = createInitialState(seed)
  let guard = 0
  while (s.phase !== 'ended' && guard++ < 80) {
    if (s.phase === 'planning') {
      s = step(s, { type: 'commitDay', plan: planFor(s) }).state
    } else if (s.phase === 'choice') {
      const optionId = s.pendingChoice?.optionIds[0] ?? ''
      s = step(s, { type: 'resolveChoice', optionId }).state
    } else {
      break
    }
  }
  return s
}

describe('engine', () => {
  it('commitDay で日が進み report が埋まる', () => {
    const s0 = createInitialState(5)
    const { state, effects } = step(s0, { type: 'commitDay', plan: idle })
    expect(state.day).toBe(2)
    expect(effects.length).toBeGreaterThan(0)
    expect(state.report).toEqual(effects)
  })

  it('同じ seed・同じ行動なら同一結果（決定性）', () => {
    const a = play(777, (s) => autoAssign(s))
    const b = play(777, (s) => autoAssign(s))
    expect(a).toEqual(b)
  })

  it('30日で終了し、いずれかのエンディングに到達する', () => {
    const s = play(42, (s2) => autoAssign(s2))
    expect(s.phase).toBe('ended')
    expect(s.ending).toBeDefined()
    expect(s.day).toBeLessThanOrEqual(BALANCE.days + 1)
  })

  it('何も配置しなければいずれ崩壊する', () => {
    const s = play(11, () => idle)
    expect(s.phase).toBe('ended')
    expect(s.ending).toBe('collapse')
  })

  it('終了後の step は状態を変えない', () => {
    const s = play(42, (s2) => autoAssign(s2))
    const after = step(s, { type: 'commitDay', plan: idle })
    expect(after.state).toBe(s)
    expect(after.effects).toHaveLength(0)
  })

  it('preview は実際の任務フェーズの効果と一致する', () => {
    const s0 = createInitialState(5)
    const plan: DayPlan = {
      placements: [
        { task: 'repair_power', unitIds: ['engineer'] },
        { task: 'restore_road', unitIds: ['farmer'] },
      ],
      ration: true,
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
