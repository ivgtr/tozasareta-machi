import { PHYSICAL_TASKS } from '../../game/data/tasks'
import type { TaskId } from '../../game/types'
import { TASK_PRESENTATION } from '../task-presentation'
import { COLORS } from '../tokens'
import type { FacilityId } from './layout'

export interface FacilityMeta {
  id: FacilityId
  label: string
  glyph: string
  color: number
  tasks: TaskId[]
}

function facilityTasks(facility: FacilityId): TaskId[] {
  return PHYSICAL_TASKS.filter((task) => TASK_PRESENTATION[task].facility === facility)
}

export const FACILITIES: Record<FacilityId, FacilityMeta> = {
  hq: { id: 'hq', label: '本部', glyph: '本', color: COLORS.inkDim, tasks: facilityTasks('hq') },
  power: {
    id: 'power',
    label: '発電設備',
    glyph: '電',
    color: COLORS.cyan,
    tasks: facilityTasks('power'),
  },
  road: {
    id: 'road',
    label: '崩落地点',
    glyph: '道',
    color: COLORS.amber,
    tasks: facilityTasks('road'),
  },
  clinic: {
    id: 'clinic',
    label: '診療所',
    glyph: '救',
    color: COLORS.green,
    tasks: facilityTasks('clinic'),
  },
  plaza: {
    id: 'plaza',
    label: '広場・集会所',
    glyph: '炊',
    color: COLORS.gold,
    tasks: facilityTasks('plaza'),
  },
  warehouse: {
    id: 'warehouse',
    label: '倉庫・配給所',
    glyph: '庫',
    color: COLORS.amber,
    tasks: facilityTasks('warehouse'),
  },
}

export type FacilityViewId = 'normal' | 'low' | 'working' | 'collapsed' | 'restored' | 'damaged'
