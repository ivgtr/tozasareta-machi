import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { emptyPlan, withMove } from '../src/scene/plan'
import { derivePlanningForecast, derivePlanningStatus } from '../src/scene/planning/model'

describe('derivePlanningStatus', () => {
  it('待機人数と配置コストを計画表示用に集約する', () => {
    const state = createInitialState(1)
    const empty = derivePlanningStatus(state, emptyPlan())
    expect(empty.remaining).toBe(state.units.length)
    expect(empty.plannedBudget).toBe(0)

    const placed = withMove(state, emptyPlan(), 'mayor', 'repair_power')!
    const status = derivePlanningStatus(state, placed)
    expect(status.remaining).toBe(state.units.length - 1)
    expect(status.placementBudget).toBe(20)
    expect(status.plannedBudget).toBe(20)
  })

  it('調達が不足なら見込み予算に加算しない', () => {
    const state = { ...createInitialState(1), budget: 0 }
    const plan = { ...emptyPlan(), procure: true }
    const status = derivePlanningStatus(state, plan)
    expect(status.procureAffordable).toBe(false)
    expect(status.plannedBudget).toBe(0)
  })
})

describe('derivePlanningForecast', () => {
  it('配置による確定差分と進行を集約する', () => {
    const state = createInitialState(1)
    const powerPlan = withMove(state, emptyPlan(), 'engineer', 'repair_power')!
    const plan = withMove(state, powerPlan, 'farmer', 'restore_road')!
    const forecast = derivePlanningForecast(state, plan)

    expect(forecast.resources.power).toBeGreaterThan(0)
    expect(forecast.resources.food).toBeGreaterThan(0)
    expect(forecast.budget).toBe(-20)
    expect(forecast.progress.restore_road).toBe(forecast.resources.food)
  })

  it('実行可能な調達だけを確定差分に含める', () => {
    const rich = createInitialState(1)
    const affordable = derivePlanningForecast(rich, { ...emptyPlan(), procure: true })
    expect(affordable.budget).toBe(-15)
    expect(affordable.stockpile).toBe(12)

    const poor = { ...rich, budget: 0 }
    expect(derivePlanningForecast(poor, { ...emptyPlan(), procure: true })).toMatchObject({
      budget: 0,
      stockpile: 0,
    })
  })
})
