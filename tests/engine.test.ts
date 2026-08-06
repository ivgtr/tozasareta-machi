import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { step } from '../src/game/engine'
import { autoAssign, resolvePlacement } from '../src/game/actions'
import { BALANCE } from '../src/game/data/balance'
import type { DayPlan, GameState } from '../src/game/types'

const idle: DayPlan = { placements: [], ration: false, procure: false }

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
  it('初期状態の資源は BALANCE の初期値と一致する', () => {
    const s = createInitialState(1)
    expect(s.resources.food).toBe(BALANCE.food.start)
    expect(s.resources.power).toBe(BALANCE.power.start)
    expect(s.resources.medical).toBe(BALANCE.medical.start)
    expect(s.resources.morale).toBe(BALANCE.morale.start)
    expect(s.budget).toBe(BALANCE.budget.start)
    expect(s.stockpile).toBe(BALANCE.stockpile.start)
  })

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

  it('commitDay の任務効果は resolvePlacement と一致する', () => {
    const s0 = createInitialState(5)
    const plan: DayPlan = {
      placements: [
        { task: 'repair_power', unitIds: ['engineer'] },
        { task: 'restore_road', unitIds: ['farmer'] },
      ],
      ration: true,
      procure: false,
    }
    const pv = plan.placements.flatMap((p) => resolvePlacement(s0, p))
    const applied = step(s0, { type: 'commitDay', plan }).effects.filter(
      (e) => e.source.startsWith('task:') && e.source !== 'task:ration',
    )
    const key = (e: { source: string; target: string; delta: number }) =>
      `${e.source}|${e.target}|${e.delta}`
    expect(pv.map(key).sort()).toEqual(applied.map(key).sort())
  })

  it('探索中のユニットは任務で働けない（産出・XP・負傷なし）', () => {
    const s0 = createInitialState(5)
    const s: GameState = {
      ...s0,
      units: s0.units.map((u) => (u.id === 'farmer' ? { ...u, expedition: s0.day } : u)),
    }
    const plan: DayPlan = {
      placements: [{ task: 'restore_road', unitIds: ['farmer'] }],
      ration: false,
      procure: false,
    }
    const { state, effects } = step(s, { type: 'commitDay', plan })
    expect(effects.filter((e) => e.source === 'task:restore_road')).toHaveLength(0)
    const away = state.units.find((u) => u.id === 'farmer')
    expect(away?.expedition).toBe(s0.day)
    expect(away?.xp).toBe(0)
    expect(away?.condition).toBe('healthy')
  })

  it('備蓄不足の distribute は解決できない（支払い超過なし）', () => {
    const s0 = createInitialState(7)
    const s: GameState = {
      ...s0,
      day: 9,
      phase: 'choice',
      stockpile: 2,
      resources: { ...s0.resources, morale: 50 },
      pendingChoice: { eventId: 'stockpile_crisis', optionIds: ['distribute', 'reserve'] },
    }
    const before = s.stockpile
    const beforeMorale = s.resources.morale
    const { state } = step(s, { type: 'resolveChoice', optionId: 'distribute' })
    expect(state).toBe(s)
    expect(state.stockpile).toBe(before)
    expect(state.resources.morale).toBe(beforeMorale)
  })
})
