import type { TaskId } from '../game/types'
import { TASK_IDS } from '../game/data/tasks'
import type { FacilityId } from './town/layout'

export type TaskFxKind = 'work' | 'pulse'

export interface TaskPresentation {
  label: string
  facility: FacilityId
  fxKind: TaskFxKind
}

export const TASK_PRESENTATION: Record<TaskId, TaskPresentation> = {
  repair_power: { label: '発電所の修理', facility: 'power', fxKind: 'work' },
  restore_road: { label: '道路復旧', facility: 'road', fxKind: 'work' },
  reinforce_medical: { label: '医療班増員', facility: 'clinic', fxKind: 'work' },
  soup_kitchen: { label: '炊き出し', facility: 'plaza', fxKind: 'work' },
  ration: { label: '節約配給', facility: 'warehouse', fxKind: 'pulse' },
}

export const TASK_LABEL = Object.fromEntries(
  TASK_IDS.map((task) => [task, TASK_PRESENTATION[task].label]),
) as Record<TaskId, string>
