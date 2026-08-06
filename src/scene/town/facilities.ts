import type { TaskId } from '../../game/types'
import { COLORS } from '../tokens'
import type { FacilityId } from './layout'

export interface FacilityMeta {
  id: FacilityId
  label: string
  glyph: string
  color: number
  tasks: TaskId[]
}

export const FACILITIES: Record<FacilityId, FacilityMeta> = {
  hq: { id: 'hq', label: '本部', glyph: '本', color: COLORS.inkDim, tasks: [] },
  power: {
    id: 'power',
    label: '発電設備',
    glyph: '電',
    color: COLORS.cyan,
    tasks: ['repair_power'],
  },
  road: {
    id: 'road',
    label: '崩落地点',
    glyph: '道',
    color: COLORS.amber,
    tasks: ['restore_road'],
  },
  clinic: {
    id: 'clinic',
    label: '診療所',
    glyph: '救',
    color: COLORS.green,
    tasks: ['reinforce_medical'],
  },
  plaza: {
    id: 'plaza',
    label: '広場・集会所',
    glyph: '炊',
    color: COLORS.gold,
    tasks: ['soup_kitchen'],
  },
  warehouse: {
    id: 'warehouse',
    label: '倉庫・配給所',
    glyph: '庫',
    color: COLORS.amber,
    tasks: [],
  },
}

export const FACILITY_IDS = Object.keys(FACILITIES) as FacilityId[]

export type FacilityViewId = 'normal' | 'low' | 'working' | 'collapsed' | 'restored' | 'damaged'
