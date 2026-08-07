import type { DayPlan, Effect, GameState } from '../game/types'
import type { StoreAction, StoreTransition } from '../store'

interface TurnStore {
  dispatch(action: StoreAction): StoreTransition
}

interface TurnPlayback {
  start(previousState: GameState, effects: Effect[], finalState: GameState): void
  skip(): void
}

/** Storeの状態遷移結果を、そのまま再生制御へ引き渡す境界。 */
export class TurnCoordinator {
  constructor(
    private readonly store: TurnStore,
    private readonly playback: TurnPlayback,
  ) {}

  commit(plan: DayPlan): StoreTransition {
    return this.play(this.store.dispatch({ type: 'commitDay', plan }))
  }

  resolveChoice(optionId: string): StoreTransition {
    return this.play(this.store.dispatch({ type: 'resolveChoice', optionId }))
  }

  restart(seed: number): StoreTransition {
    this.playback.skip()
    return this.store.dispatch({ type: 'newGame', seed })
  }

  private play(transition: StoreTransition): StoreTransition {
    if (transition.changed) {
      this.playback.start(transition.previousState, transition.effects, transition.store.state)
    }
    return transition
  }
}
