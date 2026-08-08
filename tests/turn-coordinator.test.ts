import { describe, expect, it, vi } from 'vitest'
import { TurnCoordinator } from '../src/scene/turn-coordinator'
import { createInitialState } from '../src/game/state'
import type { DayPlan, Effect } from '../src/game/types'
import type { StoreAction, StoreState, StoreTransition } from '../src/store'

const idle: DayPlan = { placements: [], ration: false, procure: false }

function transition(changed = true): StoreTransition {
  const previousState = createInitialState(1)
  const effects: Effect[] = [{ day: 1, source: 'test', target: 'food', delta: 1, reason: 'test' }]
  const store: StoreState = {
    state: changed ? { ...previousState, day: 2 } : previousState,
    history: changed ? [previousState] : [],
  }
  return {
    store,
    previousState,
    effects: changed ? effects : [],
    changed,
  }
}

describe('TurnCoordinator', () => {
  it('commit はStore遷移を一度だけ実行し、計画由来の担当人物を再生へ渡す', () => {
    const result = transition()
    const plan: DayPlan = {
      placements: [{ task: 'repair_power', unitIds: ['engineer'] }],
      ration: false,
      procure: false,
    }
    const dispatch = vi.fn((action: StoreAction): StoreTransition => {
      expect(action.type).toBe('commitDay')
      return result
    })
    const start = vi.fn()
    const coordinator = new TurnCoordinator({ dispatch }, { start, cancel: vi.fn() })

    expect(coordinator.commit(plan)).toBe(result)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'commitDay', plan })
    expect(start).toHaveBeenCalledWith(result.previousState, result.effects, {
      taskActors: { repair_power: ['engineer'] },
    })
  })

  it('no-op遷移ではPlaybackを開始しない', () => {
    const result = transition(false)
    const start = vi.fn()
    const coordinator = new TurnCoordinator({ dispatch: () => result }, { start, cancel: vi.fn() })

    coordinator.resolveChoice('invalid')
    expect(start).not.toHaveBeenCalled()
  })

  it('新規ゲームはPlaybackを破棄してからStoreを更新する', () => {
    const calls: string[] = []
    const result = transition()
    const coordinator = new TurnCoordinator(
      {
        dispatch: (action) => {
          calls.push(`dispatch:${action.type}`)
          return result
        },
      },
      {
        start: vi.fn(),
        cancel: () => calls.push('cancel'),
      },
    )

    coordinator.restart(7)
    expect(calls).toEqual(['cancel', 'dispatch:newGame'])
  })

  it('空計画でも空の担当人物契約を明示する', () => {
    const result = transition()
    const start = vi.fn()
    const coordinator = new TurnCoordinator({ dispatch: () => result }, { start, cancel: vi.fn() })

    coordinator.commit(idle)
    expect(start).toHaveBeenCalledWith(result.previousState, result.effects, { taskActors: {} })
  })
})
