import {
  TASK_IDS,
  type Aptitude,
  type DayPlan,
  type Effect,
  type GameState,
  type Placement,
  type TaskId,
  type Unit,
} from './types'
import { BALANCE } from './data/balance'
import { PHYSICAL_TASKS, TASK_DEFS } from './data/tasks'
import { isTaskDisabled, queryMult } from './modifiers'

export { PHYSICAL_TASKS } from './data/tasks'

export const TASK_APT = Object.fromEntries(
  Object.entries(TASK_DEFS).map(([task, def]) => [task, def.aptitude]),
) as Record<TaskId, Aptitude | null>

export function taskCost(task: TaskId): { budget: number; stockpile: number } {
  return TASK_DEFS[task].cost
}

export function effectMult(unit: Unit): number {
  let m = 1
  if (unit.traits.includes('hard_worker')) m *= BALANCE.trait.hard_worker
  if (unit.traits.includes('frail')) m *= BALANCE.trait.frail
  if (unit.condition === 'injured') m *= BALANCE.trait.injuredFactor
  return m
}

export function moraleMult(morale: number): number {
  const m = BALANCE.morale
  if (morale >= m.prodHighAt) return 1
  if (morale >= m.prodMidAt) return m.prodMidMult
  return m.prodLowMult
}

function unitsOnTask(state: GameState, placement: Placement): Unit[] {
  const list: Unit[] = []
  for (const id of placement.unitIds) {
    const u = state.units.find((x) => x.id === id)
    if (u) list.push(u)
  }
  return list
}

export function placementValue(state: GameState, placement: Placement): number {
  const definition = TASK_DEFS[placement.task]
  const spec = definition.output
  const apt = definition.aptitude
  if (!spec || !apt) return 0
  const onTask = unitsOnTask(state, placement)
  if (onTask.length === 0) return 0
  const hasLeader = onTask.some((u) => u.traits.includes('leader'))
  let aptSum = 0
  for (const u of onTask) {
    let a = u.apt[apt]
    if (hasLeader && !u.traits.includes('leader')) a += BALANCE.trait.leaderBonus
    aptSum += a * effectMult(u)
  }
  return Math.round(
    (spec.base + aptSum * spec.coef) *
      moraleMult(state.resources.morale) *
      queryMult(state.modifiers, `produce:${placement.task}`) *
      queryMult(state.modifiers, 'produce:all'),
  )
}

export function resolvePlacement(state: GameState, placement: Placement): Effect[] {
  const definition = TASK_DEFS[placement.task]
  const spec = definition.output
  if (!spec) return []
  const onTask = unitsOnTask(state, placement)
  if (onTask.length === 0) return []
  const day = state.day
  const effects: Effect[] = []
  const cost = definition.cost
  if (cost.budget > 0)
    effects.push({
      day,
      source: `task:${placement.task}`,
      target: 'budget',
      delta: -cost.budget,
      reason: '予算を使った',
    })
  if (cost.stockpile > 0)
    effects.push({
      day,
      source: `task:${placement.task}`,
      target: 'stockpile',
      delta: -cost.stockpile,
      reason: '備蓄を使った',
    })
  effects.push({
    day,
    source: `task:${placement.task}`,
    target: spec.resource,
    delta: placementValue(state, placement),
    reason: definition.reason,
  })
  return effects
}

export function sanitizePlan(state: GameState, plan: DayPlan): DayPlan {
  const used = new Set<string>()
  const placements: Placement[] = []
  let budget = state.budget
  let stockpile = state.stockpile
  for (const p of plan.placements) {
    if (isTaskDisabled(state.modifiers, p.task)) continue
    const unitIds: string[] = []
    const selected = new Set<string>()
    for (const id of p.unitIds) {
      if (used.has(id) || selected.has(id)) continue
      const unit = state.units.find((u) => u.id === id)
      if (!unit || isOnExpedition(unit)) continue
      selected.add(id)
      unitIds.push(id)
    }
    if (unitIds.length === 0) continue
    const cost = taskCost(p.task)
    if (budget < cost.budget || stockpile < cost.stockpile) continue
    for (const id of unitIds) used.add(id)
    budget -= cost.budget
    stockpile -= cost.stockpile
    placements.push({ task: p.task, unitIds })
  }
  const procure = plan.procure && budget >= BALANCE.procure.budget
  return { placements, ration: plan.ration, procure }
}

function maxApt(u: Unit): number {
  return Math.max(u.apt.labor, u.apt.tech, u.apt.medical, u.apt.charm)
}

export function isOnExpedition(u: Unit): boolean {
  return u.expedition !== undefined
}

export function autoAssign(state: GameState): DayPlan {
  const buckets = Object.fromEntries(TASK_IDS.map((task) => [task, [] as string[]])) as Record<
    TaskId,
    string[]
  >
  let budget = state.budget
  let stockpile = state.stockpile
  const sorted = [...state.units]
    .filter((u) => !isOnExpedition(u))
    .sort((a, b) => maxApt(b) - maxApt(a))
  for (const u of sorted) {
    let bestTask: TaskId | null = null
    let bestVal = 0
    for (const t of PHYSICAL_TASKS) {
      if (isTaskDisabled(state.modifiers, t)) continue
      const cost = taskCost(t)
      const wouldExceed = budget - cost.budget < 0 || stockpile - cost.stockpile < 0
      const alreadyPaid = buckets[t].length > 0
      if (!alreadyPaid && wouldExceed) continue
      const trial: Placement = { task: t, unitIds: [...buckets[t], u.id] }
      const gain =
        placementValue(state, trial) - placementValue(state, { task: t, unitIds: buckets[t] })
      if (gain > bestVal) {
        bestVal = gain
        bestTask = t
      }
    }
    if (bestTask) {
      if (buckets[bestTask].length === 0) {
        const cost = taskCost(bestTask)
        budget -= cost.budget
        stockpile -= cost.stockpile
      }
      buckets[bestTask].push(u.id)
    }
  }
  const placements: Placement[] = PHYSICAL_TASKS.filter((t) => buckets[t].length > 0).map((t) => ({
    task: t,
    unitIds: buckets[t],
  }))
  return { placements, ration: false, procure: false }
}
