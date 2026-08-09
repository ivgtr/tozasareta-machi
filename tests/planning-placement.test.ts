import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { emptyPlan } from '../src/scene/plan'
import {
  deriveFacilityPlacementCandidate,
  focusedFacilityId,
  placementUnitId,
  type PlanningIntent,
} from '../src/scene/planning/placement'

describe('PlanningIntent', () => {
  it('配置対象と施設閲覧を同時に持たない', () => {
    const unit: PlanningIntent = { kind: 'place-unit', unitId: 'mayor' }
    const facility: PlanningIntent = { kind: 'inspect-facility', facilityId: 'road' }

    expect(placementUnitId(unit)).toBe('mayor')
    expect(focusedFacilityId(unit)).toBeNull()
    expect(placementUnitId(facility)).toBeNull()
    expect(focusedFacilityId(facility)).toBe('road')
  })
})

describe('deriveFacilityPlacementCandidate', () => {
  it('施設に紐づくtaskへ配置可否を投影する', () => {
    const state = createInitialState(1)
    expect(deriveFacilityPlacementCandidate(state, emptyPlan(), 'mayor', 'road')).toMatchObject({
      kind: 'available',
      facility: 'road',
      task: 'restore_road',
    })
    expect(deriveFacilityPlacementCandidate(state, emptyPlan(), 'mayor', 'hq')).toEqual({
      kind: 'passive',
      facility: 'hq',
    })
  })

  it('利用不能なunitを共通契約で拒否する', () => {
    const state = createInitialState(1)
    const unavailable = {
      ...state,
      units: state.units.map((unit) => (unit.id === 'mayor' ? { ...unit, expedition: 2 } : unit)),
    }

    expect(
      deriveFacilityPlacementCandidate(unavailable, emptyPlan(), 'mayor', 'road'),
    ).toMatchObject({ kind: 'blocked', reason: 'unit-unavailable' })
  })
})
