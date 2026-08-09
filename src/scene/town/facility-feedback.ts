import type { FacilityPlacementCandidate } from '../planning/placement'

export function facilityPlacementAlpha(
  candidate: { kind: FacilityPlacementCandidate['kind'] } | null,
): number {
  return candidate?.kind === 'blocked' || candidate?.kind === 'passive' ? 0.48 : 1
}
