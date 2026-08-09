import type { GameState } from '../../game/types'
import {
  derivePlacementCandidate,
  type PlacementBlockReason,
  type PlacementCandidate,
  type PlanState,
} from '../plan'
import { FACILITIES } from '../town/facilities'
import { FACILITY_PLOTS, type FacilityId } from '../town/layout'

export type PlanningIntent =
  | { kind: 'none' }
  | { kind: 'place-unit'; unitId: string }
  | { kind: 'inspect-facility'; facilityId: FacilityId }
  | { kind: 'choose-unit-for-facility'; facilityId: FacilityId }

type WithFacility<C extends PlacementCandidate> = C extends unknown
  ? C & { facility: FacilityId; reason?: PlacementBlockReason }
  : never

export type FacilityPlacementCandidate =
  { kind: 'passive'; facility: FacilityId; reason?: undefined } | WithFacility<PlacementCandidate>

export type FacilityPlacementMap = Record<FacilityId, FacilityPlacementCandidate>

export function placementUnitId(intent: PlanningIntent): string | null {
  return intent.kind === 'place-unit' ? intent.unitId : null
}

export function focusedFacilityId(intent: PlanningIntent): FacilityId | null {
  return intent.kind === 'inspect-facility' || intent.kind === 'choose-unit-for-facility'
    ? intent.facilityId
    : null
}

export function assignmentTargetFacilityId(intent: PlanningIntent): FacilityId | null {
  return intent.kind === 'choose-unit-for-facility' ? intent.facilityId : null
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

export function deriveFacilityPlacementCandidates(
  state: GameState,
  plan: PlanState,
  unitId: string,
): FacilityPlacementMap {
  return Object.fromEntries(
    FACILITY_PLOTS.map(({ id }) => [id, deriveFacilityPlacementCandidate(state, plan, unitId, id)]),
  ) as FacilityPlacementMap
}
