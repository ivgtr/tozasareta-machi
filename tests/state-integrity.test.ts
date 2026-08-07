import { describe, expect, it } from 'vitest'
import { applyEffects } from '../src/game/effects'
import { applyAutoEvent, isEventEligible } from '../src/game/events'
import { EVENTS } from '../src/game/data/events-data'
import { step } from '../src/game/engine'
import { createInitialState } from '../src/game/state'
import { parseStore, serializeStore, type StoreState } from '../src/store'
import type { DayPlan, GameState } from '../src/game/types'

const emptyPlan: DayPlan = { placements: [], ration: false, procure: false }

function lowPowerState(seed = 1): GameState {
  const initial = createInitialState(seed)
  return {
    ...initial,
    day: 5,
    resources: {
      ...initial.resources,
      power: 20,
      medical: 100,
      morale: 100,
      food: 100,
    },
    stockpile: 100,
  }
}

function powerChoiceState(): GameState {
  const initial = createInitialState(1)
  return {
    ...initial,
    day: 9,
    phase: 'choice',
    resources: { ...initial.resources, power: 20 },
    pendingEvents: [],
    pendingChoice: {
      eventId: 'power_crisis',
      optionIds: ['divert_medical', 'endure_dark'],
    },
  }
}

describe('event sequencing', () => {
  it('autoイベント適用後にchoiceの発火条件を再評価する', () => {
    const before = lowPowerState()
    const restored = EVENTS.find((event) => event.id === 'power_restored')!
    const crisis = EVENTS.find((event) => event.id === 'power_crisis')!

    expect(isEventEligible(before, crisis)).toBe(true)
    const result = applyAutoEvent(before, restored)
    const after = applyEffects(result.state, result.effects)
    expect(after.resources.power).toBe(46)
    expect(isEventEligible(after, crisis)).toBe(false)
  })

  it('productionのstep経路でもpower_restored後にpower_crisisを予約しない', () => {
    const root = lowPowerState()
    const prepared: GameState = {
      ...root,
      resources: { ...root.resources, power: 30 },
    }
    let restoredCount = 0

    for (let seed = 1; seed <= 1000; seed++) {
      const result = step(
        { ...prepared, rng: { seed, counter: 0 } },
        { type: 'commitDay', plan: emptyPlan },
      )
      if (!result.effects.some((effect) => effect.source === 'event:power_restored')) continue
      restoredCount += 1
      expect(result.state.pendingChoice?.eventId).not.toBe('power_crisis')
    }

    expect(restoredCount).toBeGreaterThan(0)
  })
})

describe('choice state recovery', () => {
  it('存在しないchoiceイベントは同じ日を再実行せず次の日へ復旧する', () => {
    const state: GameState = {
      ...powerChoiceState(),
      pendingChoice: { eventId: 'removed_event', optionIds: ['removed_option'] },
    }

    const result = step(state, { type: 'resolveChoice', optionId: 'removed_option' })
    expect(result.state.phase).toBe('planning')
    expect(result.state.day).toBe(state.day + 1)
    expect(result.state.pendingChoice).toBeUndefined()
  })

  it('ロード時に孤児化したchoiceを復旧する', () => {
    const state: GameState = {
      ...powerChoiceState(),
      pendingChoice: { eventId: 'removed_event', optionIds: ['removed_option'] },
    }
    const store: StoreState = { state, history: [] }

    const parsed = parseStore(serializeStore(store))
    expect(parsed?.state.phase).toBe('planning')
    expect(parsed?.state.day).toBe(state.day + 1)
    expect(parsed?.state.pendingChoice).toBeUndefined()
  })

  it('ロード時に削除済みoption IDだけを除去する', () => {
    const state: GameState = {
      ...powerChoiceState(),
      pendingChoice: {
        eventId: 'power_crisis',
        optionIds: ['divert_medical', 'removed_option', 'endure_dark'],
      },
    }
    const parsed = parseStore(serializeStore({ state, history: [] }))

    expect(parsed?.state.phase).toBe('choice')
    expect(parsed?.state.pendingChoice?.optionIds).toEqual(['divert_medical', 'endure_dark'])
  })
})
