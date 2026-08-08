import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import type { GameState, Modifier } from '../src/game/types'
import { deriveTownAmbience } from '../src/scene/town/ambience-model'
import type { FacilityViewMap } from '../src/scene/town/facilities'

const NORMAL_VIEW: FacilityViewMap = {
  hq: 'normal',
  power: 'normal',
  road: 'collapsed',
  clinic: 'normal',
  plaza: 'normal',
  warehouse: 'normal',
}

function state(patch: Partial<GameState> = {}): GameState {
  const initial = createInitialState(1)
  return { ...initial, ...patch }
}

function modifier(id: string): Modifier {
  return { id, daysLeft: 2, startDay: 1, effects: [] }
}

describe('deriveTownAmbience', () => {
  it('通常状態を安定した町として導出する', () => {
    const model = deriveTownAmbience(state(), NORMAL_VIEW)

    expect(model.act).toBe(1)
    expect(model.weather).toBe('clear')
    expect(model.power.condition).toBe('stable')
    expect(model.medical.condition).toBe('stable')
    expect(model.morale.condition).toBe('stable')
    expect(model.danger).toBe(false)
    expect(model.workingFacilities).toEqual([])
  })

  it('既存のゲーム閾値から資源危機を導出する', () => {
    const model = deriveTownAmbience(
      state({ resources: { food: 8, power: 0, medical: 29, morale: 19 } }),
      NORMAL_VIEW,
    )

    expect(model.power).toMatchObject({ condition: 'critical', lights: 0 })
    expect(model.medical.condition).toBe('critical')
    expect(model.morale.condition).toBe('critical')
    expect(model.danger).toBe(true)
  })

  it('低下中と安定状態を既存の回復閾値で分ける', () => {
    const model = deriveTownAmbience(
      state({ resources: { food: 100, power: 35, medical: 40, morale: 30 } }),
      NORMAL_VIEW,
    )

    expect(model.power.condition).toBe('strained')
    expect(model.medical.condition).toBe('strained')
    expect(model.morale.condition).toBe('strained')
    expect(model.danger).toBe(false)
  })

  it('施設の作業状態を環境演出へ投影する', () => {
    const view: FacilityViewMap = {
      ...NORMAL_VIEW,
      power: 'working',
      road: 'working',
      clinic: 'working',
      plaza: 'working',
    }
    const model = deriveTownAmbience(state(), view)

    expect(model.workingFacilities).toEqual(['power', 'road', 'clinic', 'plaza'])
    expect(model.road).toBe('working')
  })

  it('台風を寒波より優先しアクト進行も同じモデルへ集約する', () => {
    const model = deriveTownAmbience(
      state({
        day: 21,
        modifiers: [modifier('cold_snap'), modifier('typhoon')],
      }),
      NORMAL_VIEW,
    )

    expect(model.act).toBe(3)
    expect(model.weather).toBe('typhoon')
  })

  it('探索中ユニットを食料安全度の必要人数から除外する', () => {
    const base = state()
    const allPresent = deriveTownAmbience(base, NORMAL_VIEW)
    const units = base.units.map((unit, index) => (index === 0 ? { ...unit, expedition: 1 } : unit))
    const expedition = deriveTownAmbience({ ...base, units }, NORMAL_VIEW)

    expect(expedition.supplies.foodSecurity).toBeGreaterThan(allPresent.supplies.foodSecurity)
  })
})
