import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { emptyPlan, withMove } from '../src/scene/plan'
import { derivePlanningStatus } from '../src/scene/planning/model'

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
