import { BALANCE } from '../../game/data/balance'
import { PHYSICAL_TASKS, placementValue, resolvePlacement } from '../../game/actions'
import type { GameState, TaskId } from '../../game/types'
import { spentOf, unassignedUnits, type PlanState } from '../plan'

export interface PlanningStatus {
  remaining: number
  placementBudget: number
  placementStockpile: number
  plannedBudget: number
  plannedStockpile: number
  procureAffordable: boolean
}

export interface PlanningForecast {
  resources: {
    food: number
    power: number
    medical: number
    morale: number
  }
  budget: number
  stockpile: number
  progress: Partial<Record<TaskId, number>>
}

export function derivePlanningForecast(state: GameState, plan: PlanState): PlanningForecast {
  const forecast: PlanningForecast = {
    resources: { food: 0, power: 0, medical: 0, morale: 0 },
    budget: 0,
    stockpile: 0,
    progress: {},
  }
  for (const task of PHYSICAL_TASKS) {
    const unitIds = plan.placements[task] ?? []
    if (unitIds.length === 0) continue
    const placement = { task, unitIds }
    forecast.progress[task] = placementValue(state, placement)
    for (const effect of resolvePlacement(state, placement)) {
      if (effect.target === 'budget') forecast.budget += effect.delta
      else if (effect.target === 'stockpile') forecast.stockpile += effect.delta
      else if (effect.target in forecast.resources) {
        forecast.resources[effect.target as keyof PlanningForecast['resources']] += effect.delta
      }
    }
  }
  const status = derivePlanningStatus(state, plan)
  if (plan.procure && status.procureAffordable) {
    forecast.budget -= BALANCE.procure.budget
    forecast.stockpile += BALANCE.procure.stockpile
  }
  return forecast
}

export function derivePlanningStatus(state: GameState, plan: PlanState): PlanningStatus {
  const spent = spentOf(plan.placements)
  const procureAffordable = state.budget - spent.budget >= BALANCE.procure.budget
  const procureBudget = plan.procure && procureAffordable ? BALANCE.procure.budget : 0
  return {
    remaining: unassignedUnits(state, plan).length,
    placementBudget: spent.budget,
    placementStockpile: spent.stockpile,
    plannedBudget: spent.budget + procureBudget,
    plannedStockpile: spent.stockpile,
    procureAffordable,
  }
}
