import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { step } from '../src/game/engine'
import { transitionStore, type StoreState } from '../src/store'
import type { DayPlan, GameState } from '../src/game/types'

const idle: DayPlan = { placements: [], ration: false, procure: false }

function initialStore(): StoreState {
  return { state: createInitialState(1), history: [] }
}

describe('transitionStore', () => {
  it('commitDay の状態とEffectを同じ遷移結果から返す', () => {
    const store = initialStore()
    const expected = step(store.state, { type: 'commitDay', plan: idle })
    const transition = transitionStore(store, { type: 'commitDay', plan: idle })

    expect(transition.previousState).toBe(store.state)
    expect(transition.store.state).toEqual(expected.state)
    expect(transition.effects).toEqual(expected.effects)
    expect(transition.store.history).toEqual([store.state])
    expect(transition.changed).toBe(true)
  })

  it('無効な選択肢は変更なしとして返す', () => {
    const state: GameState = {
      ...createInitialState(1),
      phase: 'choice',
      pendingChoice: {
        eventId: 'stockpile_crisis',
        optionIds: ['distribute', 'reserve'],
      },
    }
    const store: StoreState = { state, history: [] }
    const transition = transitionStore(store, {
      type: 'resolveChoice',
      optionId: 'invalid',
    })

    expect(transition.store).toBe(store)
    expect(transition.previousState).toBe(state)
    expect(transition.effects).toEqual([])
    expect(transition.changed).toBe(false)
  })
})
