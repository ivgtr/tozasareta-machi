import { describe, expect, it } from 'vitest'
import { BALANCE } from '../src/game/data/balance'
import { EVENTS } from '../src/game/data/events-data'
import { step } from '../src/game/engine'
import { createInitialState } from '../src/game/state'
import type { DayPlan, Effect, GameState } from '../src/game/types'
import { buildBeats } from '../src/scene/playback/beats'
import { buildStoryMilestoneFixture } from '../src/scene/testing/story-milestone-fixtures'

const idle: DayPlan = { placements: [], ration: false, procure: false }
const contactDay = BALANCE.days - BALANCE.rescue.contactDaysRemaining + 1

function crossDay(from: GameState): { state: GameState; effects: Effect[] } {
  let state = from
  const effects: Effect[] = []
  for (let guard = 0; state.day === from.day && guard < 20; guard += 1) {
    const result =
      state.phase === 'choice'
        ? step(state, {
            type: 'resolveChoice',
            optionId: state.pendingChoice?.optionIds[0] ?? '',
          })
        : step(state, { type: 'commitDay', plan: idle })
    if (result.state === state) throw new Error(`Day transition stalled at DAY ${from.day}`)
    effects.push(...result.effects)
    state = result.state
  }
  return { state, effects }
}

describe('rescue story milestone', () => {
  it('removes rescue_contact from the random event catalog', () => {
    expect(EVENTS.some((event) => event.id === 'rescue_contact')).toBe(false)
  })

  it('derives the fixed contact day from the configured rescue horizon', () => {
    expect(contactDay).toBe(26)
    const fixture = buildStoryMilestoneFixture('rescue_near')
    expect(fixture).toMatchObject({
      pageCount: 1,
      isLast: true,
      spec: { completeLabel: '計画へ ▶' },
      page: {
        kicker: `救援隊から通信 / DAY ${contactDay}`,
        title: `救援まであと ${BALANCE.rescue.contactDaysRemaining} 日`,
        art: { kind: 'event', id: 'rescue_contact' },
      },
    })
  })

  it('emits the contact exactly once when DAY 25 advances to DAY 26 and applies morale in engine', () => {
    const base = createInitialState(4500)
    const before: GameState = {
      ...base,
      day: contactDay - 1,
      resources: { ...base.resources, morale: 50 },
    }
    const crossed = crossDay(before)
    const rescue = crossed.effects.filter((effect) => effect.source === 'rescue_near')

    expect(crossed.state.day).toBe(contactDay)
    expect(rescue).toHaveLength(1)
    expect(rescue[0]).toMatchObject({
      day: contactDay - 1,
      target: 'morale',
      delta: BALANCE.rescue.contactMorale,
    })
    const withoutRescue = crossed.effects
      .filter((effect) => effect.source !== 'rescue_near' && effect.target === 'morale')
      .reduce((sum, effect) => sum + effect.delta, 50)
    expect(crossed.state.resources.morale).toBe(
      Math.max(0, Math.min(100, withoutRescue + BALANCE.rescue.contactMorale)),
    )
    expect(crossed.state.report.filter((effect) => effect.source === 'rescue_near')).toHaveLength(1)

    const next = crossDay(crossed.state)
    expect(next.effects.some((effect) => effect.source === 'rescue_near')).toBe(false)
  })

  it('does not replay the contact when resuming on or after DAY 26', () => {
    for (const day of [contactDay, contactDay + 1]) {
      const resumed = crossDay({ ...createInitialState(4700 + day), day })
      expect(resumed.effects.some((effect) => effect.source === 'rescue_near')).toBe(false)
    }
  })

  it('projects rescue_near through the same playback milestone contract as Act transitions', () => {
    const effect: Effect = {
      day: contactDay - 1,
      source: 'rescue_near',
      target: 'morale',
      delta: BALANCE.rescue.contactMorale,
      reason: '救援隊から通信が届いた',
    }
    expect(buildBeats([effect])).toEqual([
      { kind: 'milestone', id: 'rescue_near', effects: [effect] },
    ])
  })
})
