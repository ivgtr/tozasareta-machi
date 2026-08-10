import { isTaskId, TASK_IDS } from '../../game/data/tasks'
import type { TaskId } from '../../game/types'
import { TASK_PRESENTATION, type TaskFxKind } from '../task-presentation'
import type { FacilityId } from './layout'

export type FxKind = TaskFxKind | 'float' | 'weather' | 'arrival'

export interface FxEntry {
  facility: FacilityId | null
  kind: FxKind
  sfx?: string
}

const GENERIC: FxEntry = { facility: null, kind: 'float' }

const TASK_FX = Object.fromEntries(
  TASK_IDS.map((task) => {
    const presentation = TASK_PRESENTATION[task]
    return [task, { facility: presentation.facility, kind: presentation.fxKind }]
  }),
) as Record<TaskId, FxEntry>

const PROCURE_FX: FxEntry = { facility: 'warehouse', kind: 'pulse' }

const EVENT_FX: Record<string, FxEntry> = {
  elderly_illness: { facility: 'clinic', kind: 'pulse' },
  generator_failure: { facility: 'power', kind: 'pulse' },
  arrival: { facility: 'road', kind: 'arrival' },
  hidden_stockpile: { facility: 'warehouse', kind: 'float' },
  foraging: { facility: 'warehouse', kind: 'float' },
  power_restored: { facility: 'power', kind: 'float' },
  medical_donation: { facility: 'clinic', kind: 'float' },
  road_collapse: { facility: 'road', kind: 'pulse' },
  volunteers: { facility: 'plaza', kind: 'float' },
  ration_protest: { facility: 'plaza', kind: 'pulse' },
  infection: { facility: 'clinic', kind: 'pulse' },
  protest: { facility: 'plaza', kind: 'pulse' },
  water_shortage: { facility: 'plaza', kind: 'pulse' },
  theft: { facility: 'warehouse', kind: 'pulse' },
  radio_repair: { facility: 'hq', kind: 'float' },
  childbirth: { facility: 'plaza', kind: 'float' },
  elder_death: { facility: 'plaza', kind: 'pulse' },
  wildlife: { facility: 'road', kind: 'pulse' },
  clear_weather: { facility: null, kind: 'weather' },
  landslide_warning: { facility: 'road', kind: 'pulse' },
  manna: { facility: 'warehouse', kind: 'float' },
  supply_drop: { facility: 'warehouse', kind: 'float' },
  hot_spring: { facility: 'plaza', kind: 'float' },
  miracle_harvest: { facility: 'warehouse', kind: 'float' },
  sunny_stretch: { facility: null, kind: 'weather' },
  animal_trap: { facility: 'warehouse', kind: 'float' },
  traveling_engineer: { facility: 'power', kind: 'arrival' },
  volunteer_surge: { facility: 'plaza', kind: 'float' },
  clean_water: { facility: 'warehouse', kind: 'float' },
  cached_fuel: { facility: 'power', kind: 'float' },
  typhoon: { facility: null, kind: 'weather' },
  storage_flood: { facility: 'warehouse', kind: 'pulse' },
  generator_overheat: { facility: 'power', kind: 'pulse' },
  landslide_actual: { facility: 'road', kind: 'pulse' },
  food_spoilage: { facility: 'warehouse', kind: 'pulse' },
  cold_snap: { facility: null, kind: 'weather' },
  rumor: { facility: 'plaza', kind: 'pulse' },
  rat_infestation: { facility: 'warehouse', kind: 'pulse' },
  insomnia: { facility: 'plaza', kind: 'pulse' },
  aftershock: { facility: 'road', kind: 'pulse' },
  second_wave: { facility: 'clinic', kind: 'pulse' },
  gratitude: { facility: 'plaza', kind: 'float' },
  trade_offer: { facility: 'hq', kind: 'float' },
  power_crisis: { facility: 'power', kind: 'pulse' },
  stockpile_crisis: { facility: 'warehouse', kind: 'pulse' },
  expedition: { facility: 'road', kind: 'float' },
  expedition_return: { facility: 'road', kind: 'arrival' },
}

function taskFx(source: string): FxEntry | undefined {
  const id = source.slice('task:'.length)
  if (id === 'procure') return PROCURE_FX
  return isTaskId(id) ? TASK_FX[id] : undefined
}

function settlementFx(target: string): FxEntry {
  switch (target) {
    case 'food':
      return { facility: 'warehouse', kind: 'float' }
    case 'power':
      return { facility: 'power', kind: 'float' }
    case 'medical':
      return { facility: 'clinic', kind: 'float' }
    case 'morale':
      return { facility: 'plaza', kind: 'float' }
    case 'budget':
      return { facility: 'hq', kind: 'float' }
    case 'stockpile':
      return { facility: 'warehouse', kind: 'float' }
    default:
      return GENERIC
  }
}

export function resolveFx(source: string, target: string): FxEntry {
  if (source.startsWith('task:')) return taskFx(source) ?? GENERIC
  if (source === 'settlement') return settlementFx(target)
  if (target.startsWith('unit:')) return { facility: 'road', kind: 'arrival' }
  const id = source.startsWith('event:') ? source.slice('event:'.length) : source
  return EVENT_FX[id] ?? GENERIC
}

export function hasExplicitFx(source: string): boolean {
  if (source.startsWith('task:')) return taskFx(source) !== undefined
  if (source === 'settlement') return true
  const id = source.startsWith('event:') ? source.slice('event:'.length) : source
  return id in EVENT_FX
}
