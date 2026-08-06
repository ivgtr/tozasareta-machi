import type { GameState, TaskId } from '../../game/types'
import { BALANCE } from '../../game/data/balance'
import type { PlanState } from '../plan'
import type { FacilityViewId } from './facilities'
import { FACILITY_PLOTS, type FacilityId } from './layout'

export function deriveFacilityView(
  state: GameState,
  plan: PlanState,
): Record<FacilityId, FacilityViewId> {
  const placed = (task: TaskId): boolean => (plan.placements[task] ?? []).length > 0
  return {
    hq: 'normal',
    power: placed('repair_power')
      ? 'working'
      : state.resources.power < BALANCE.power.lowAt
        ? 'low'
        : 'normal',
    road: placed('restore_road') ? 'working' : 'collapsed',
    clinic: placed('reinforce_medical') ? 'working' : 'normal',
    plaza: placed('soup_kitchen') ? 'working' : 'normal',
    warehouse: 'normal',
  }
}

export function facilityAssetId(facility: FacilityId, view: FacilityViewId): string {
  return `${facility}-${view}`
}

export function plotsById(): Map<FacilityId, (typeof FACILITY_PLOTS)[number]> {
  return new Map(FACILITY_PLOTS.map((p) => [p.id, p]))
}
