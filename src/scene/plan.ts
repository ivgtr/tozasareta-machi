import type { DayPlan, GameState, TaskId, Unit } from '../game/types'
import { PHYSICAL_TASKS, isOnExpedition, taskCost } from '../game/actions'
import { isTaskDisabled } from '../game/modifiers'

export type Placements = Partial<Record<TaskId, string[]>>

export interface PlanState {
  placements: Placements
  ration: boolean
  procure: boolean
}

export type PlacementBlockReason = 'unit-unavailable' | 'task-disabled' | 'budget' | 'stockpile'

export type PlacementCandidate =
  | { kind: 'available' | 'current'; task: TaskId; nextPlan: PlanState }
  | { kind: 'blocked'; task: TaskId; reason: PlacementBlockReason }

export function emptyPlan(): PlanState {
  return { placements: {}, ration: false, procure: false }
}

export function assignedIds(plan: PlanState): Set<string> {
  return new Set(PHYSICAL_TASKS.flatMap((t) => plan.placements[t] ?? []))
}

export function assignedTask(plan: PlanState, unitId: string): TaskId | null {
  return PHYSICAL_TASKS.find((task) => plan.placements[task]?.includes(unitId)) ?? null
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

function movedPlacements(plan: PlanState, unitId: string, task: TaskId): Placements {
  const next: Placements = {}
  for (const candidate of PHYSICAL_TASKS) {
    next[candidate] = (plan.placements[candidate] ?? []).filter((id) => id !== unitId)
  }
  next[task] = [...(next[task] ?? []), unitId]
  return next
}

export function derivePlacementCandidate(
  state: GameState,
  plan: PlanState,
  unitId: string,
  task: TaskId,
): PlacementCandidate {
  const unit = state.units.find((candidate) => candidate.id === unitId)
  if (!unit || isOnExpedition(unit)) return { kind: 'blocked', task, reason: 'unit-unavailable' }
  if (isTaskDisabled(state.modifiers, task))
    return { kind: 'blocked', task, reason: 'task-disabled' }

  const placements = movedPlacements(plan, unitId, task)
  const spent = spentOf(placements)
  if (spent.budget > state.budget) return { kind: 'blocked', task, reason: 'budget' }
  if (spent.stockpile > state.stockpile) return { kind: 'blocked', task, reason: 'stockpile' }

  return {
    kind: assignedTask(plan, unitId) === task ? 'current' : 'available',
    task,
    nextPlan: { ...plan, placements },
  }
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
