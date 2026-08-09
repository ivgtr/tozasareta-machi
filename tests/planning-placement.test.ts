import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { emptyPlan } from '../src/scene/plan'
import {
  assignmentTargetFacilityId,
  deriveFacilityPlacementCandidate,
  deriveFacilityPlacementCandidates,
  focusedFacilityId,
  placementUnitId,
  type PlanningIntent,
} from '../src/scene/planning/placement'

describe('PlanningIntent', () => {
  it('配置対象・施設閲覧・施設起点選択を排他的に持つ', () => {
    const unit: PlanningIntent = { kind: 'place-unit', unitId: 'mayor' }
    const facility: PlanningIntent = { kind: 'inspect-facility', facilityId: 'road' }
    const choose: PlanningIntent = { kind: 'choose-unit-for-facility', facilityId: 'power' }

    expect(placementUnitId(unit)).toBe('mayor')
    expect(focusedFacilityId(unit)).toBeNull()
    expect(assignmentTargetFacilityId(unit)).toBeNull()
    expect(placementUnitId(facility)).toBeNull()
    expect(focusedFacilityId(facility)).toBe('road')
    expect(assignmentTargetFacilityId(facility)).toBeNull()
    expect(placementUnitId(choose)).toBeNull()
    expect(focusedFacilityId(choose)).toBe('power')
    expect(assignmentTargetFacilityId(choose)).toBe('power')
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

  it('全施設の可否を同じ契約から導出する', () => {
    const state = createInitialState(1)
    const candidates = deriveFacilityPlacementCandidates(state, emptyPlan(), 'mayor')

    expect(candidates.road).toMatchObject({ kind: 'available', task: 'restore_road' })
    expect(candidates.hq).toEqual({ kind: 'passive', facility: 'hq' })
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
