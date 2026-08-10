import Phaser from 'phaser'
import { step } from '../../game/engine'
import { createInitialState } from '../../game/state'
import type { DayPlan, Effect, GameState } from '../../game/types'
import { saveStore } from '../../store'
import { emptyPlan, type PlanState } from '../plan'
import type { PlaybackContext } from '../playback/beats'
import type { PlanningIntent } from '../planning/placement'
import { sharedStore } from '../store-bridge'

interface PlaySceneInternals {
  playback?: {
    cancel: () => void
    start: (state: GameState, effects: Effect[], context?: PlaybackContext) => void
  }
  planningIntent?: PlanningIntent
  plan?: PlanState
  refresh?: () => void
}

interface ActTransitionE2EBridge {
  showActTransition?: (fromDay: 10 | 20) => void
  savePlanningDay?: (day: number) => void
}

type E2EWindow = Window & {
  __TOZASARETA_MACHI_E2E__?: ActTransitionE2EBridge
}

const IDLE_PLAN: DayPlan = { placements: [], ration: false, procure: false }

function crossBoundary(fromDay: 10 | 20): { state: GameState; effect: Effect } {
  const source = fromDay === 10 ? 'act_stalemate' : 'act_final'
  let state: GameState = { ...createInitialState(4400 + fromDay), day: fromDay }
  const effects: Effect[] = []

  for (let guard = 0; state.day === fromDay && guard < 20; guard += 1) {
    const result =
      state.phase === 'choice'
        ? step(state, {
            type: 'resolveChoice',
            optionId: state.pendingChoice?.optionIds[0] ?? '',
          })
        : step(state, { type: 'commitDay', plan: IDLE_PLAN })
    if (result.state === state) throw new Error(`Act E2E transition stalled at DAY ${fromDay}`)
    effects.push(...result.effects)
    state = result.state
  }

  const effect = effects.find((candidate) => candidate.source === source)
  if (state.day !== fromDay + 1 || !effect) {
    throw new Error(`Act E2E transition did not emit ${source} from DAY ${fromDay}`)
  }
  return { state, effect }
}

function showActTransition(game: Phaser.Game, fromDay: 10 | 20): void {
  const result = crossBoundary(fromDay)
  const store = sharedStore().get()
  store.state = result.state
  store.history = []
  saveStore(store)

  const play = game.scene.getScene('Play') as unknown as PlaySceneInternals
  play.playback?.cancel()
  play.planningIntent = { kind: 'none' }
  play.plan = emptyPlan()
  play.playback?.start(result.state, [result.effect])
  play.refresh?.()
}

function savePlanningDay(day: number): void {
  const store = sharedStore().get()
  store.state = { ...createInitialState(4600 + day), day }
  store.history = []
  saveStore(store)
}

export function installActTransitionE2E(game: Phaser.Game): void {
  const target = window as E2EWindow
  const bridge = target.__TOZASARETA_MACHI_E2E__
  if (!bridge) throw new Error('Base E2E bridge must be installed first')
  bridge.showActTransition = (fromDay) => showActTransition(game, fromDay)
  bridge.savePlanningDay = (day) => savePlanningDay(day)
}
