import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import type { GameState, Modifier } from '../src/game/types'
import { deriveTownAmbience } from '../src/scene/town/ambience-model'

function state(patch: Partial<GameState> = {}): GameState {
  const initial = createInitialState(1)
  return { ...initial, ...patch }
}

function modifier(id: string): Modifier {
  return { id, daysLeft: 2, startDay: 1, effects: [] }
}

describe('deriveTownAmbience', () => {
  it('通常状態を安定した町として導出する', () => {
    const model = deriveTownAmbience(state())

    expect(model.act).toBe(1)
    expect(model.weather).toBe('clear')
    expect(model.power.condition).toBe('stable')
    expect(model.medical.condition).toBe('stable')
    expect(model.morale.condition).toBe('stable')
    expect(model.danger).toBe(false)
  })

  it('既存のゲーム閾値から資源危機を導出する', () => {
    const model = deriveTownAmbience(
      state({ resources: { food: 8, power: 0, medical: 29, morale: 19 } }),
    )

    expect(model.power).toMatchObject({ condition: 'critical', lights: 0 })
    expect(model.medical.condition).toBe('critical')
    expect(model.morale.condition).toBe('critical')
    expect(model.danger).toBe(true)
  })

  it('低下中と安定状態を既存の回復閾値で分ける', () => {
    const model = deriveTownAmbience(
      state({ resources: { food: 100, power: 35, medical: 40, morale: 30 } }),
    )

    expect(model.power.condition).toBe('strained')
    expect(model.medical.condition).toBe('strained')
    expect(model.morale.condition).toBe('strained')
    expect(model.danger).toBe(false)
  })

  it('台風を寒波より優先しアクト進行も同じモデルへ集約する', () => {
    const model = deriveTownAmbience(
      state({
        day: 21,
        modifiers: [modifier('cold_snap'), modifier('typhoon')],
      }),
    )

    expect(model.act).toBe(3)
    expect(model.weather).toBe('typhoon')
  })

  it('探索中ユニットを食料安全度の必要人数から除外する', () => {
    const base = state()
    const allPresent = deriveTownAmbience(base)
    const units = base.units.map((unit, index) => (index === 0 ? { ...unit, expedition: 1 } : unit))
    const expedition = deriveTownAmbience({ ...base, units })

    expect(expedition.supplies.foodSecurity).toBeGreaterThan(allPresent.supplies.foodSecurity)
  })
})
