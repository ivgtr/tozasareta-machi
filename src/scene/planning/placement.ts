import type { GameState } from '../../game/types'
import { derivePlacementCandidate, type PlacementCandidate, type PlanState } from '../plan'
import { FACILITIES } from '../town/facilities'
import type { FacilityId } from '../town/layout'

export type PlanningIntent =
  | { kind: 'none' }
  | { kind: 'place-unit'; unitId: string }
  | { kind: 'inspect-facility'; facilityId: FacilityId }

export type FacilityPlacementCandidate =
  { kind: 'passive'; facility: FacilityId } | (PlacementCandidate & { facility: FacilityId })

export function placementUnitId(intent: PlanningIntent): string | null {
  return intent.kind === 'place-unit' ? intent.unitId : null
}

export function focusedFacilityId(intent: PlanningIntent): FacilityId | null {
  return intent.kind === 'inspect-facility' ? intent.facilityId : null
}

export function deriveFacilityPlacementCandidate(
  state: GameState,
  plan: PlanState,
  unitId: string,
  facility: FacilityId,
): FacilityPlacementCandidate {
  const task = FACILITIES[facility].task
  if (!task) return { kind: 'passive', facility }
  return { ...derivePlacementCandidate(state, plan, unitId, task), facility }
}
