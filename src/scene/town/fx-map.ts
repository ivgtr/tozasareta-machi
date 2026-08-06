import type { FacilityId } from './layout'

export type FxKind = 'work' | 'float' | 'pulse' | 'weather' | 'act' | 'arrival'

export interface FxEntry {
  facility: FacilityId | null
  kind: FxKind
  sfx?: string
}

const GENERIC: FxEntry = { facility: null, kind: 'float' }

const TASK_FX: Record<string, FxEntry> = {
  'task:repair_power': { facility: 'power', kind: 'work' },
  'task:restore_road': { facility: 'road', kind: 'work' },
  'task:reinforce_medical': { facility: 'clinic', kind: 'work' },
  'task:soup_kitchen': { facility: 'plaza', kind: 'work' },
  'task:ration': { facility: 'warehouse', kind: 'pulse' },
  'task:procure': { facility: 'warehouse', kind: 'pulse' },
}

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
  rescue_contact: { facility: 'hq', kind: 'float' },
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

const ACT_SOURCES = new Set(['act_stalemate', 'act_final'])

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
  if (source.startsWith('task:')) return TASK_FX[source] ?? GENERIC
  if (source === 'settlement') return settlementFx(target)
  if (ACT_SOURCES.has(source)) return { facility: null, kind: 'act' }
  if (target.startsWith('unit:')) return { facility: 'road', kind: 'arrival' }
  const id = source.startsWith('event:') ? source.slice('event:'.length) : source
  return EVENT_FX[id] ?? GENERIC
}

export function hasExplicitFx(source: string): boolean {
  if (source.startsWith('task:')) return source in TASK_FX
  if (source === 'settlement') return true
  if (ACT_SOURCES.has(source)) return true
  const id = source.startsWith('event:') ? source.slice('event:'.length) : source
  return id in EVENT_FX
}
