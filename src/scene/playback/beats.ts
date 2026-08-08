import { isTaskId } from '../../game/data/tasks'
import type { DayPlan, Effect, TaskId } from '../../game/types'

export const UI_TIMING = {
  flowMs: 1600,
  reducedFlowMs: 650,
  afterConfirmMs: 250,
} as const

export interface PlaybackContext {
  taskActors: Partial<Record<TaskId, readonly string[]>>
}

export interface FlowBeat {
  kind: 'flow'
  source: string
  actorIds: string[]
  effects: Effect[]
}

export type Beat =
  | FlowBeat
  | { kind: 'event'; id: string; effects: Effect[] }
  | { kind: 'arrival'; unitId: string; effects: Effect[] }

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
