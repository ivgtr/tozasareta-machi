import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import {
  FACILITY_PLOTS,
  facilityAt,
  footprintDiamond,
  isInsideFootprint,
  project,
} from '../src/scene/town/layout'
import { deriveFacilityView, facilityAssetId } from '../src/scene/town/facility-view'
import { facilityPlacementAlpha } from '../src/scene/town/facility-feedback'
import {
  buildPlan,
  derivePlacementCandidate,
  emptyPlan,
  spentOf,
  unassignedUnits,
  withRemove,
} from '../src/scene/plan'
import type { GameState } from '../src/game/types'

describe('layout', () => {
  it('project は 2:1 ダイアモンド投影', () => {
    expect(project(3, 3)).toEqual({ x: 240, y: 168 })
    expect(project(1, 3).x).toBeLessThan(240)
    expect(project(3, 1).x).toBeGreaterThan(240)
  })

  it('§1.3 の構図どおりのプロット配置', () => {
    const byId = new Map(FACILITY_PLOTS.map((p) => [p.id, p]))
    const hq = byId.get('hq')!
    const power = byId.get('power')!
    const clinic = byId.get('clinic')!
    const warehouse = byId.get('warehouse')!
    const plaza = byId.get('plaza')!
    const road = byId.get('road')!
    expect(power.x).toBeLessThan(hq.x)
    expect(clinic.x).toBeGreaterThan(hq.x)
    expect(power.y).toBeLessThan(hq.y)
    expect(clinic.y).toBeLessThan(hq.y)
    expect(warehouse.x).toBeLessThan(hq.x)
    expect(plaza.y).toBeGreaterThan(hq.y)
    expect(road.y).toBeGreaterThan(hq.y)
    expect(road.x).toBeGreaterThan(hq.x)
  })

  it('フットプリント内判定', () => {
    expect(isInsideFootprint(240, 168, 240, 168)).toBe(true)
    expect(isInsideFootprint(240 + 47, 168, 240, 168)).toBe(true)
    expect(isInsideFootprint(240 + 49, 168, 240, 168)).toBe(false)
    expect(isInsideFootprint(240, 168 + 25, 240, 168)).toBe(false)
    expect(footprintDiamond(240, 168)).toHaveLength(8)
  })

  it('facilityAt はプロット中心を返す', () => {
    for (const p of FACILITY_PLOTS) {
      expect(facilityAt(p.x, p.y)).toBe(p.id)
    }
    expect(facilityAt(10, 300)).toBeNull()
  })
})

describe('deriveFacilityView', () => {
  const state = (): GameState => createInitialState(1)

  it('初期状態: power normal / road collapsed / 他 normal', () => {
    const view = deriveFacilityView(state(), emptyPlan())
    expect(view.power).toBe('normal')
    expect(view.road).toBe('collapsed')
    expect(view.clinic).toBe('normal')
    expect(view.plaza).toBe('normal')
    expect(view.warehouse).toBe('normal')
    expect(view.hq).toBe('normal')
  })

  it('配置で working、電力低下で low', () => {
    const s = state()
    const plan = {
      ...emptyPlan(),
      placements: { repair_power: ['mayor'], soup_kitchen: ['medic'] },
    }
    const view = deriveFacilityView(s, plan)
    expect(view.power).toBe('working')
    expect(view.plaza).toBe('working')
    const low = state()
    low.resources.power = 20
    expect(deriveFacilityView(low, emptyPlan()).power).toBe('low')
  })

  it('アセットIDを導出する', () => {
    expect(facilityAssetId('power', 'low')).toBe('power-low')
    expect(facilityAssetId('road', 'collapsed')).toBe('road-collapsed')
  })
})

describe('facility placement feedback', () => {
  it('配置不能な施設だけをdim表示する', () => {
    expect(facilityPlacementAlpha(null)).toBe(1)
    expect(facilityPlacementAlpha({ kind: 'available' })).toBe(1)
    expect(facilityPlacementAlpha({ kind: 'current' })).toBe(1)
    expect(facilityPlacementAlpha({ kind: 'passive' })).toBe(0.48)
    expect(facilityPlacementAlpha({ kind: 'blocked' })).toBe(0.48)
  })
})

describe('plan', () => {
  it('derivePlacementCandidate は配置可否と理由を一意に返す', () => {
    const s = createInitialState(1)
    const ok = derivePlacementCandidate(s, emptyPlan(), 'mayor', 'restore_road')
    expect(ok.kind).toBe('available')

    const broke = { ...s, budget: 0 }
    expect(derivePlacementCandidate(broke, emptyPlan(), 'mayor', 'repair_power')).toMatchObject({
      kind: 'blocked',
      reason: 'budget',
    })
    expect(derivePlacementCandidate(broke, emptyPlan(), 'mayor', 'restore_road').kind).toBe(
      'available',
    )

    const locked: GameState = {
      ...s,
      modifiers: [
        {
          id: 'typhoon',
          daysLeft: 2,
          startDay: 1,
          effects: [{ target: 'produce:soup_kitchen', op: 'set', value: 0 }],
        },
      ],
    }
    expect(derivePlacementCandidate(locked, emptyPlan(), 'mayor', 'soup_kitchen')).toMatchObject({
      kind: 'blocked',
      reason: 'task-disabled',
    })
  })

  it('配置済み判定と次Planを同じ契約から返す', () => {
    const s = createInitialState(1)
    const candidate = derivePlacementCandidate(s, emptyPlan(), 'mayor', 'repair_power')
    if (candidate.kind === 'blocked') throw new Error('expected available placement')
    const placed = candidate.nextPlan
    expect(derivePlacementCandidate(s, placed, 'mayor', 'repair_power').kind).toBe('current')
    expect(spentOf(placed.placements).budget).toBe(20)
    const removed = withRemove(placed, 'mayor')
    expect(unassignedUnits(s, removed)).toHaveLength(s.units.length)
    const plan = buildPlan(placed)
    expect(plan.placements).toEqual([{ task: 'repair_power', unitIds: ['mayor'] }])
    expect(plan.ration).toBe(false)
  })
})
