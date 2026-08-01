import type { Aptitude, DayPlan, Effect, GameState, Placement, TaskId, Unit } from './types'
import { BALANCE } from './data/balance'

export const PHYSICAL_TASKS: TaskId[] = [
  'repair_power',
  'restore_road',
  'reinforce_medical',
  'soup_kitchen',
]

export const TASK_APT: Record<TaskId, Aptitude | null> = {
  repair_power: 'tech',
  restore_road: 'labor',
  reinforce_medical: 'medical',
  soup_kitchen: 'charm',
  ration: null,
}

const TASK_RES: Record<
  TaskId,
  { res: 'food' | 'power' | 'medical' | 'morale'; base: number; coef: number } | null
> = {
  repair_power: {
    res: 'power',
    base: BALANCE.effect.repair.base,
    coef: BALANCE.effect.repair.coef,
  },
  restore_road: { res: 'food', base: BALANCE.effect.road.base, coef: BALANCE.effect.road.coef },
  reinforce_medical: {
    res: 'medical',
    base: BALANCE.effect.medical.base,
    coef: BALANCE.effect.medical.coef,
  },
  soup_kitchen: { res: 'morale', base: BALANCE.effect.soup.base, coef: BALANCE.effect.soup.coef },
  ration: null,
}

const TASK_REASON: Record<TaskId, string> = {
  repair_power: '発電設備を修理し、電力が回復した',
  restore_road: '道路を復旧し、食料を搬入した',
  reinforce_medical: '医療班を増員した',
  soup_kitchen: '炊き出しを行い、住民が元気を取り戻した',
  ration: '',
}

export function taskCost(task: TaskId): { budget: number; stockpile: number } {
  const t = BALANCE.tasks
  return {
    budget:
      task === 'repair_power'
        ? t.repair_power.budget
        : task === 'reinforce_medical'
          ? t.reinforce_medical.budget
          : 0,
    stockpile: task === 'soup_kitchen' ? t.soup_kitchen.stockpile : 0,
  }
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
  const spec = TASK_RES[placement.task]
  const apt = TASK_APT[placement.task]
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
  return Math.round((spec.base + aptSum * spec.coef) * moraleMult(state.resources.morale))
}

export function resolvePlacement(state: GameState, placement: Placement): Effect[] {
  const spec = TASK_RES[placement.task]
  if (!spec) return []
  const onTask = unitsOnTask(state, placement)
  if (onTask.length === 0) return []
  const day = state.day
  const effects: Effect[] = []
  const cost = taskCost(placement.task)
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
    target: spec.res,
    delta: placementValue(state, placement),
    reason: TASK_REASON[placement.task],
  })
  return effects
}

export function sanitizePlan(state: GameState, plan: DayPlan): DayPlan {
  const used = new Set<string>()
  const placements: Placement[] = []
  let budget = state.budget
  let stockpile = state.stockpile
  for (const p of plan.placements) {
    const unitIds: string[] = []
    for (const id of p.unitIds) {
      if (used.has(id)) continue
      if (!state.units.some((u) => u.id === id)) continue
      used.add(id)
      unitIds.push(id)
    }
    if (unitIds.length === 0) continue
    const cost = taskCost(p.task)
    if (budget < cost.budget || stockpile < cost.stockpile) continue
    budget -= cost.budget
    stockpile -= cost.stockpile
    placements.push({ task: p.task, unitIds })
  }
  return { placements, ration: plan.ration }
}

export function preview(state: GameState, plan: DayPlan): Effect[] {
  const clean = sanitizePlan(state, plan)
  const effects: Effect[] = []
  for (const p of clean.placements) effects.push(...resolvePlacement(state, p))
  if (clean.ration) {
    const consume = Math.round(state.units.length * BALANCE.unit.foodPerUnit * 0.5)
    effects.push({
      day: state.day,
      source: 'task:ration',
      target: 'food',
      delta: consume,
      reason: '配給を絞り、消費を抑える見込み',
    })
    effects.push({
      day: state.day,
      source: 'task:ration',
      target: 'morale',
      delta: BALANCE.morale.ration,
      reason: '配給を絞れば不満が出る見込み',
    })
  }
  return effects
}

function maxApt(u: Unit): number {
  return Math.max(u.apt.labor, u.apt.tech, u.apt.medical, u.apt.charm)
}

export function autoAssign(state: GameState): DayPlan {
  const buckets: Record<TaskId, string[]> = {
    repair_power: [],
    restore_road: [],
    reinforce_medical: [],
    soup_kitchen: [],
    ration: [],
  }
  let budget = state.budget
  let stockpile = state.stockpile
  const sorted = [...state.units].sort((a, b) => maxApt(b) - maxApt(a))
  for (const u of sorted) {
    let bestTask: TaskId | null = null
    let bestVal = 0
    for (const t of PHYSICAL_TASKS) {
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
  return { placements, ration: false }
}
