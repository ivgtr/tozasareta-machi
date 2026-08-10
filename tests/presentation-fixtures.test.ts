import { describe, expect, it } from 'vitest'
import { BALANCE } from '../src/game/data/balance'
import {
  buildPresentationFixture,
  fixturePresentationMode,
  PRESENTATION_FIXTURE_NAMES,
} from '../src/scene/testing/presentation-fixtures'

describe('presentation fixtures', () => {
  it('builds every presentation state deterministically', () => {
    const first = PRESENTATION_FIXTURE_NAMES.map(buildPresentationFixture)
    const second = PRESENTATION_FIXTURE_NAMES.map(buildPresentationFixture)

    expect(first).toEqual(second)
    expect(first.map((fixture) => fixture.name)).toEqual(PRESENTATION_FIXTURE_NAMES)
  })

  it('builds story states without progressing the simulation', () => {
    expect(buildPresentationFixture('act-stalemate').beat?.kind).toBe('milestone')
    expect(buildPresentationFixture('act-final').beat?.kind).toBe('milestone')
    expect(fixturePresentationMode('act-stalemate')).toBe('milestone')
    expect(fixturePresentationMode('act-final')).toBe('milestone')
    expect(buildPresentationFixture('event').beat?.kind).toBe('event')
    expect(buildPresentationFixture('event-incident').beat).toMatchObject({
      kind: 'event',
      id: 'road_collapse',
    })
    expect(fixturePresentationMode('event-incident')).toBe('event')
    expect(buildPresentationFixture('arrival').beat?.kind).toBe('arrival')
    expect(buildPresentationFixture('choice').state).toMatchObject({
      day: 8,
      phase: 'choice',
      pendingChoice: { eventId: 'trade_offer' },
    })
  })

  it('builds representative fixtures for all four endings', () => {
    const cases = [
      ['ending', 'full_recovery'],
      ['ending-sacrifice', 'managed_sacrifice'],
      ['ending-governance', 'self_governance'],
      ['ending-collapse', 'collapse'],
    ] as const

    for (const [name, ending] of cases) {
      expect(buildPresentationFixture(name).state).toMatchObject({ phase: 'ended', ending })
      expect(fixturePresentationMode(name)).toBe('ending')
    }
  })

  it('builds minor, normal, and major playback results independently', () => {
    for (const name of ['minor-result', 'normal-result', 'major-result'] as const) {
      const fixture = buildPresentationFixture(name)
      expect(fixture.beat?.kind).toBe('flow')
      expect(fixturePresentationMode(name)).toBe('flow')
    }
  })

  it('builds assigned planning with every Phase 1 working facility visible', () => {
    const fixture = buildPresentationFixture('planning-assigned')
    const ids = fixture.state.units.slice(0, 4).map((unit) => unit.id)

    expect(fixture.plan).toEqual({
      placements: {
        repair_power: [ids[0]],
        restore_road: [ids[1]],
        reinforce_medical: [ids[2]],
        soup_kitchen: [ids[3]],
      },
      ration: false,
      procure: false,
    })
    expect(fixturePresentationMode('planning-assigned')).toBe('planning')
  })

  it('builds low-power planning below the facility threshold', () => {
    const fixture = buildPresentationFixture('planning-low-power')

    expect(fixture.state.resources.power).toBe(BALANCE.power.lowAt - 1)
    expect(fixturePresentationMode('planning-low-power')).toBe('planning')
  })

  it('focus fixtures share a deterministic assignment', () => {
    const unit = buildPresentationFixture('unit-focus')
    const inspector = buildPresentationFixture('character-inspector')
    const facility = buildPresentationFixture('facility-focus')
    expect(unit.plan).toEqual(facility.plan)
    expect(inspector.plan).toEqual(unit.plan)
    expect(inspector.inspectedUnitId).toBe(inspector.state.units[0]?.id)
    expect(fixturePresentationMode('character-inspector')).toBe('unit-focus')
    expect(facility.plan?.placements.restore_road).toEqual([facility.state.units[0]?.id])
  })
})
