import { isTaskId } from '../../game/data/tasks'
import { deathCauseFromSource, type DeathCause } from '../../game/death'
import type { DayPlan, Effect, TaskId, Unit } from '../../game/types'
import { isPlayStoryMilestoneId, type PlayStoryMilestoneId } from '../story/milestone-model'

export interface PlaybackContext {
  taskActors: Partial<Record<TaskId, readonly string[]>>
}

export interface FlowBeat {
  kind: 'flow'
  source: string
  actorIds: string[]
  effects: Effect[]
}

export interface MilestoneBeat {
  kind: 'milestone'
  id: PlayStoryMilestoneId
  effects: Effect[]
}

export interface DeathBeat {
  kind: 'death'
  cause: DeathCause
  unit: Unit
  effects: Effect[]
}

export type Beat =
  | FlowBeat
  | MilestoneBeat
  | { kind: 'event'; id: string; effects: Effect[] }
  | { kind: 'arrival'; unitId: string; effects: Effect[] }
  | DeathBeat

export function playbackContextForPlan(plan: DayPlan): PlaybackContext {
  const taskActors: Partial<Record<TaskId, readonly string[]>> = {}
  for (const placement of plan.placements) taskActors[placement.task] = [...placement.unitIds]
  return { taskActors }
}

function actorsFor(source: string, context: PlaybackContext): string[] {
  if (!source.startsWith('task:')) return []
  const task = source.slice('task:'.length)
  if (!isTaskId(task)) return []
  return [...(context.taskActors[task] ?? [])]
}

function removedUnit(effects: readonly Effect[]): Unit | null {
  for (const effect of effects) {
    const change = effect.unitChanges?.find((candidate) => candidate.kind === 'remove')
    if (change?.kind === 'remove') return change.unit
  }
  return null
}

export function buildBeats(
  effects: readonly Effect[],
  context: PlaybackContext = { taskActors: {} },
): Beat[] {
  const beats: Beat[] = []
  let index = 0
  while (index < effects.length) {
    const first = effects[index]
    if (!first) break
    const source = first.source
    const group: Effect[] = []
    while (index < effects.length && effects[index]?.source === source) {
      const effect = effects[index]
      if (effect) group.push(effect)
      index++
    }

    const deathCause = deathCauseFromSource(source)
    if (deathCause) {
      const unit = removedUnit(group)
      if (!unit) throw new Error(`Death beat is missing its removed unit: ${source}`)
      beats.push({ kind: 'death', cause: deathCause, unit, effects: group })
      continue
    }

    if (isPlayStoryMilestoneId(source)) {
      beats.push({ kind: 'milestone', id: source, effects: group })
      continue
    }

    if (source.startsWith('event:')) {
      const unitEffect = group.find((effect) => effect.target.startsWith('unit:'))
      if (unitEffect) {
        beats.push({
          kind: 'arrival',
          unitId: unitEffect.target.slice('unit:'.length),
          effects: group,
        })
      } else {
        beats.push({ kind: 'event', id: source.slice('event:'.length), effects: group })
      }
      continue
    }

    beats.push({ kind: 'flow', source, actorIds: actorsFor(source, context), effects: group })
  }
  return beats
}
