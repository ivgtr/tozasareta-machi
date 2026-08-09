import { describe, expect, it } from 'vitest'
import { BALANCE } from '../src/game/data/balance'
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
  it('通常状態を安定した環境として導出する', () => {
    const current = state()
    const model = deriveTownAmbience(current)

    expect(model.act).toBe(1)
    expect(model.weather).toBe('clear')
    expect(model.powerRatio).toBe(Math.min(1, current.resources.power / 100))
    expect(model.danger).toBe(false)
  })

  it('既存の危機閾値からdangerを導出する', () => {
    const model = deriveTownAmbience(
      state({ resources: { food: 8, power: 0, medical: 29, morale: 19 } }),
    )

    expect(model.powerRatio).toBe(0)
    expect(model.danger).toBe(true)
  })

  it('powerRatioを0から1の範囲へ制限する', () => {
    expect(
      deriveTownAmbience(state({ resources: { food: 100, power: 150, medical: 100, morale: 100 } }))
        .powerRatio,
    ).toBe(1)
    expect(
      deriveTownAmbience(state({ resources: { food: 100, power: -10, medical: 100, morale: 100 } }))
        .powerRatio,
    ).toBe(0)
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

  it('探索中ユニットを食料危機の必要人数から除外する', () => {
    const base = state()
    const foodPerUnit = BALANCE.unit.foodPerUnit
    const food = Math.max(0, (base.units.length - 1) * foodPerUnit)
    const resources = { ...base.resources, food }

    expect(deriveTownAmbience({ ...base, resources }).danger).toBe(true)

    const units = base.units.map((unit, index) => (index === 0 ? { ...unit, expedition: 1 } : unit))
    expect(deriveTownAmbience({ ...base, resources, units }).danger).toBe(false)
  })
})
