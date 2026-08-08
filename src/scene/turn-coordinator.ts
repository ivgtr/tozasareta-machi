import type { DayPlan, Effect, GameState } from '../game/types'
import type { StoreAction, StoreTransition } from '../store'
import { playbackContextForPlan, type PlaybackContext } from './playback/beats'
import { buildPlaybackEffects } from './playback/contract'

interface TurnStore {
  dispatch(action: StoreAction): StoreTransition
}

interface TurnPlayback {
  start(previousState: GameState, effects: Effect[], context?: PlaybackContext): void
  cancel(): void
}

export class TurnCoordinator {
  constructor(
    private readonly store: TurnStore,
    private readonly playback: TurnPlayback,
  ) {}

  commit(plan: DayPlan): StoreTransition {
    const transition = this.store.dispatch({ type: 'commitDay', plan })
    return this.play(transition, playbackContextForPlan(plan))
  }

  resolveChoice(optionId: string): StoreTransition {
    return this.play(this.store.dispatch({ type: 'resolveChoice', optionId }))
  }

  restart(seed: number): StoreTransition {
    this.playback.cancel()
    return this.store.dispatch({ type: 'newGame', seed })
  }

  private play(transition: StoreTransition, context?: PlaybackContext): StoreTransition {
    if (transition.changed) {
      const effects = buildPlaybackEffects(
        transition.previousState,
        transition.store.state,
        transition.effects,
      )
      this.playback.start(transition.previousState, effects, context)
    }
    return transition
  }
}
