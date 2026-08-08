import { isOnExpedition } from '../../game/actions'
import type { GameState, TaskId, Unit } from '../../game/types'
import { PHYSICAL_TASKS } from '../../game/data/tasks'
import type { PlanState } from '../plan'

export type RosterStatus =
  { kind: 'waiting' } | { kind: 'assigned'; task: TaskId } | { kind: 'expedition' }

export interface RosterEntry {
  unit: Unit
  status: RosterStatus
}

export function deriveCharacterRoster(state: GameState, plan: PlanState): RosterEntry[] {
  const assignment = new Map<string, TaskId>()
  for (const task of PHYSICAL_TASKS) {
    for (const unitId of plan.placements[task] ?? []) assignment.set(unitId, task)
  }
  return state.units.map((unit) => {
    if (isOnExpedition(unit)) return { unit, status: { kind: 'expedition' } }
    const task = assignment.get(unit.id)
    if (task) return { unit, status: { kind: 'assigned', task } }
    return { unit, status: { kind: 'waiting' } }
  })
}
