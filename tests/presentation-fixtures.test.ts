import { describe, expect, it } from 'vitest'
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
    expect(buildPresentationFixture('event').beat?.kind).toBe('event')
    expect(buildPresentationFixture('arrival').beat?.kind).toBe('arrival')
    expect(buildPresentationFixture('choice').state).toMatchObject({
      day: 8,
      phase: 'choice',
      pendingChoice: { eventId: 'trade_offer' },
    })
    expect(buildPresentationFixture('ending').state).toMatchObject({
      day: 31,
      phase: 'ended',
      ending: 'full_recovery',
    })
  })

  it('builds minor, normal, and major playback results independently', () => {
    for (const name of ['minor-result', 'normal-result', 'major-result'] as const) {
      const fixture = buildPresentationFixture(name)
      expect(fixture.beat?.kind).toBe('flow')
      expect(fixturePresentationMode(name)).toBe('flow')
    }
  })

  it('focus fixtures share a deterministic assignment', () => {
    const unit = buildPresentationFixture('unit-focus')
    const facility = buildPresentationFixture('facility-focus')
    expect(unit.plan).toEqual(facility.plan)
    expect(facility.plan?.placements.restore_road).toEqual([facility.state.units[0]?.id])
  })
})
