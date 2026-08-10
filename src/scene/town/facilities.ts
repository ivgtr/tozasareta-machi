import { PHYSICAL_TASKS } from '../../game/data/tasks'
import type { TaskId } from '../../game/types'
import { TASK_PRESENTATION } from '../task-presentation'
import { COLORS } from '../tokens'
import type { FacilityId } from './layout'

export interface FacilityMeta {
  id: FacilityId
  label: string
  color: number
  task: TaskId | null
}

function facilityTask(facility: FacilityId): TaskId | null {
  return PHYSICAL_TASKS.find((task) => TASK_PRESENTATION[task].facility === facility) ?? null
}

export const FACILITIES: Record<FacilityId, FacilityMeta> = {
  hq: { id: 'hq', label: '本部', color: COLORS.inkDim, task: facilityTask('hq') },
  power: {
    id: 'power',
    label: '発電設備',
    color: COLORS.cyan,
    task: facilityTask('power'),
  },
  road: {
    id: 'road',
    label: '崩落地点',
    color: COLORS.amber,
    task: facilityTask('road'),
  },
  clinic: {
    id: 'clinic',
    label: '診療所',
    color: COLORS.green,
    task: facilityTask('clinic'),
  },
  plaza: {
    id: 'plaza',
    label: '広場・集会所',
    color: COLORS.gold,
    task: facilityTask('plaza'),
  },
  warehouse: {
    id: 'warehouse',
    label: '倉庫・配給所',
    color: COLORS.amber,
    task: facilityTask('warehouse'),
  },
}

export interface FacilityViewMap {
  hq: 'normal'
  power: 'normal' | 'low' | 'working'
  road: 'collapsed' | 'working'
  clinic: 'normal' | 'working'
  plaza: 'normal' | 'working'
  warehouse: 'normal'
}

export type FacilityViewId = FacilityViewMap[FacilityId]
