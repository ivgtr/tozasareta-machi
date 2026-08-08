import { describe, expect, it } from 'vitest'
import {
  buildPresentationFixture,
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
})
