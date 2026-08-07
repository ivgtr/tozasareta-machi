import { BALANCE } from '../../game/data/balance'
import type { GameState } from '../../game/types'
import { spentOf, unassignedUnits, type PlanState } from '../plan'

export interface PlanningStatus {
  remaining: number
  placementBudget: number
  placementStockpile: number
  plannedBudget: number
  plannedStockpile: number
  procureAffordable: boolean
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
