import type { Assignment, Character, DayPlan, Effect, GameState, TaskId } from './types'
import { BALANCE } from './data/balance'

interface TaskDef {
  id: TaskId
  minWorkers: number
  budgetCost: number
  stockpileCost: number
  specialty?: string
}

export const TASKS: Record<TaskId, TaskDef> = {
  repair_power: {
    id: 'repair_power',
    minWorkers: 1,
    budgetCost: BALANCE.tasks.repair_power.budget,
    stockpileCost: 0,
    specialty: 'engineer',
  },
  restore_road: { id: 'restore_road', minWorkers: 1, budgetCost: 0, stockpileCost: 0 },
  reinforce_medical: {
    id: 'reinforce_medical',
    minWorkers: 1,
    budgetCost: BALANCE.tasks.reinforce_medical.budget,
    stockpileCost: 0,
    specialty: 'medic',
  },
  soup_kitchen: {
    id: 'soup_kitchen',
    minWorkers: 1,
    budgetCost: 0,
    stockpileCost: BALANCE.tasks.soup_kitchen.stockpile,
    specialty: 'mayor',
  },
  ration: { id: 'ration', minWorkers: 0, budgetCost: 0, stockpileCost: 0 },
}

function findCharacter(state: GameState, id: string | undefined): Character | undefined {
  if (!id) return undefined
  return state.characters.find((c) => c.id === id)
}

function specialtyBonus(def: TaskDef, character: Character | undefined, divisor: number): number {
  if (!character || !def.specialty || character.id !== def.specialty) return 0
  return Math.round(character.skill / divisor)
}

export function resolveAssignment(state: GameState, assignment: Assignment): Effect[] {
  const def = TASKS[assignment.task]
  const day = state.day
  const w = assignment.workers
  const who = findCharacter(state, assignment.characterId)
  const effects: Effect[] = []
  const push = (target: Effect['target'], delta: number, reason: string) =>
    effects.push({ day, source: `task:${def.id}`, target, delta, reason })

  switch (def.id) {
    case 'repair_power': {
      push('budget', -def.budgetCost, '発電設備の修理に予算を使った')
      const gain =
        BALANCE.power.repairBase +
        BALANCE.power.repairPerWorker * w +
        specialtyBonus(def, who, BALANCE.tasks.repair_power.divisor)
      push('power', gain, '発電設備を修理し、電力が回復した')
      break
    }
    case 'restore_road': {
      const food = BALANCE.food.perWorker * w
      const stock = BALANCE.stockpile.perWorker * w
      push('food', food, '道路を復旧し、食料を搬入した')
      push('stockpile', stock, '道路を復旧し、備蓄を搬入した')
      break
    }
    case 'reinforce_medical': {
      push('budget', -def.budgetCost, '医療班の増員に予算を使った')
      const factor = state.resources.power >= BALANCE.medical.lowPowerAt ? 1 : 0.6
      const gain = Math.round(
        (BALANCE.medical.reinforceBase +
          BALANCE.medical.reinforcePerWorker * w +
          specialtyBonus(def, who, BALANCE.tasks.reinforce_medical.divisor)) *
          factor,
      )
      push('medical', gain, factor === 1 ? '医療班を増員した' : '電力不足の中、医療班を増員した')
      break
    }
    case 'soup_kitchen': {
      push('stockpile', -def.stockpileCost, '炊き出しに備蓄を使った')
      const gain =
        BALANCE.tasks.soup_kitchen.base +
        specialtyBonus(def, who, BALANCE.tasks.soup_kitchen.divisor)
      push('morale', gain, '炊き出しを行い、住民が元気を取り戻した')
      break
    }
    case 'ration':
      break
  }
  return effects
}

export function sanitizePlan(state: GameState, plan: DayPlan): DayPlan {
  const usedCharacters = new Set<string>()
  let remaining = state.workers
  const assignments: Assignment[] = []
  for (const a of plan.assignments) {
    const def = TASKS[a.task]
    if (!def) continue
    const workers = Math.max(def.minWorkers === 0 ? 0 : 1, Math.floor(a.workers))
    if (def.minWorkers > 0) {
      if (workers > remaining) continue
      remaining -= workers
    }
    if (a.characterId) {
      if (usedCharacters.has(a.characterId)) continue
      if (!findCharacter(state, a.characterId)) continue
      usedCharacters.add(a.characterId)
    }
    if (state.budget < def.budgetCost) continue
    if (state.stockpile < def.stockpileCost) continue
    assignments.push({
      task: a.task,
      workers: def.minWorkers === 0 ? 0 : workers,
      characterId: a.characterId,
    })
  }
  return { assignments }
}

export function preview(state: GameState, plan: DayPlan): Effect[] {
  const clean = sanitizePlan(state, plan)
  const effects: Effect[] = []
  for (const a of clean.assignments) effects.push(...resolveAssignment(state, a))
  if (clean.assignments.some((a) => a.task === 'ration')) {
    const saved = Math.round(BALANCE.food.consume * 0.5)
    effects.push({
      day: state.day,
      source: 'task:ration',
      target: 'food',
      delta: saved,
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
