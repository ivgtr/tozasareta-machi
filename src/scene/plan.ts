import type { DayPlan, GameState, TaskId, Unit } from '../game/types'
import { PHYSICAL_TASKS, isOnExpedition, taskCost } from '../game/actions'
import { isTaskDisabled } from '../game/modifiers'

export type Placements = Partial<Record<TaskId, string[]>>

export interface PlanState {
  placements: Placements
  ration: boolean
  procure: boolean
}

export function emptyPlan(): PlanState {
  return { placements: {}, ration: false, procure: false }
}

export function assignedIds(plan: PlanState): Set<string> {
  return new Set(PHYSICAL_TASKS.flatMap((t) => plan.placements[t] ?? []))
}

export function unassignedUnits(state: GameState, plan: PlanState): Unit[] {
  const ids = assignedIds(plan)
  return state.units.filter((u) => !ids.has(u.id) && !isOnExpedition(u))
}

export function expeditionUnits(state: GameState): Unit[] {
  return state.units.filter((u) => isOnExpedition(u))
}

export function spentOf(placements: Placements): { budget: number; stockpile: number } {
  const spent = { budget: 0, stockpile: 0 }
  for (const t of PHYSICAL_TASKS) {
    if ((placements[t] ?? []).length > 0) {
      const c = taskCost(t)
      spent.budget += c.budget
      spent.stockpile += c.stockpile
    }
  }
  return spent
}

export function isAffordable(state: GameState, placements: Placements, task: TaskId): boolean {
  if ((placements[task] ?? []).length > 0) return true
  const c = taskCost(task)
  const spent = spentOf(placements)
  return state.budget - spent.budget >= c.budget && state.stockpile - spent.stockpile >= c.stockpile
}

function placementsAffordable(state: GameState, placements: Placements): boolean {
  const spent = spentOf(placements)
  return spent.budget <= state.budget && spent.stockpile <= state.stockpile
}

export function withMove(
  state: GameState,
  plan: PlanState,
  unitId: string,
  task: TaskId,
): PlanState | null {
  if (isTaskDisabled(state.modifiers, task)) return null
  const next: Placements = {}
  for (const t of PHYSICAL_TASKS) next[t] = (plan.placements[t] ?? []).filter((u) => u !== unitId)
  next[task] = [...(next[task] ?? []), unitId]
  if (!placementsAffordable(state, next)) return null
  return { ...plan, placements: next }
}

export function withRemove(plan: PlanState, unitId: string): PlanState {
  const next: Placements = {}
  for (const t of PHYSICAL_TASKS) next[t] = (plan.placements[t] ?? []).filter((u) => u !== unitId)
  return { ...plan, placements: next }
}

export function fromAutoAssign(plan: DayPlan): PlanState {
  const placements: Placements = {}
  for (const p of plan.placements) placements[p.task] = p.unitIds
  return { placements, ration: false, procure: false }
}

export function buildPlan(plan: PlanState): DayPlan {
  return {
    placements: PHYSICAL_TASKS.filter((t) => (plan.placements[t] ?? []).length > 0).map((t) => ({
      task: t,
      unitIds: plan.placements[t] ?? [],
    })),
    ration: plan.ration,
    procure: plan.procure,
  }
}
