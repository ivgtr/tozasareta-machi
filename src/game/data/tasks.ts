import { TASK_IDS, type Aptitude, type TaskId } from '../types'
import { BALANCE } from './balance'

export type TaskResource = 'food' | 'power' | 'medical' | 'morale'

export interface TaskDefinition {
  physical: boolean
  aptitude: Aptitude | null
  output: { resource: TaskResource; base: number; coef: number } | null
  cost: { budget: number; stockpile: number }
  reason: string
}

export { TASK_IDS } from '../types'

export const TASK_DEFS: Record<TaskId, TaskDefinition> = {
  repair_power: {
    physical: true,
    aptitude: 'tech',
    output: {
      resource: 'power',
      base: BALANCE.effect.repair.base,
      coef: BALANCE.effect.repair.coef,
    },
    cost: { budget: BALANCE.tasks.repair_power.budget, stockpile: 0 },
    reason: '発電設備を修理し、電力が回復した',
  },
  restore_road: {
    physical: true,
    aptitude: 'labor',
    output: {
      resource: 'food',
      base: BALANCE.effect.road.base,
      coef: BALANCE.effect.road.coef,
    },
    cost: { budget: 0, stockpile: 0 },
    reason: '道路を復旧し、食料を搬入した',
  },
  reinforce_medical: {
    physical: true,
    aptitude: 'medical',
    output: {
      resource: 'medical',
      base: BALANCE.effect.medical.base,
      coef: BALANCE.effect.medical.coef,
    },
    cost: { budget: BALANCE.tasks.reinforce_medical.budget, stockpile: 0 },
    reason: '医療班を増員した',
  },
  soup_kitchen: {
    physical: true,
    aptitude: 'charm',
    output: {
      resource: 'morale',
      base: BALANCE.effect.soup.base,
      coef: BALANCE.effect.soup.coef,
    },
    cost: { budget: BALANCE.tasks.soup_kitchen.budget, stockpile: 0 },
    reason: '炊き出しを行い、住民が元気を取り戻した',
  },
  ration: {
    physical: false,
    aptitude: null,
    output: null,
    cost: { budget: 0, stockpile: 0 },
    reason: '',
  },
}

const TASK_ID_SET = new Set<string>(TASK_IDS)

export function isTaskId(value: string): value is TaskId {
  return TASK_ID_SET.has(value)
}

export const PHYSICAL_TASKS = TASK_IDS.filter((task) => TASK_DEFS[task].physical)
