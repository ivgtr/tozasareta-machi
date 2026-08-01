import type { Effect, EvalContext, GameState } from './types'
import { EVENTS } from './data/events-data'
import { weightedPick } from './rng'

export interface RunEventsResult {
  state: GameState
  effects: Effect[]
}

export function runEvents(prev: GameState): RunEventsResult {
  const ctx: EvalContext = { state: prev, flags: prev.flags, day: prev.day }
  const candidates = EVENTS.filter(
    (e) => (!e.once || !prev.flags.fired.includes(e.id)) && e.when(ctx) && e.weight(ctx) > 0,
  )
  if (candidates.length === 0) return { state: prev, effects: [] }

  const picked = weightedPick(candidates, (e) => e.weight(ctx), prev.rng)
  if (!picked) return { state: prev, effects: [] }
  const [event, rng] = picked
  const effects = event.apply(ctx)
  const fired = event.once ? [...prev.flags.fired, event.id] : prev.flags.fired
  return {
    state: { ...prev, flags: { ...prev.flags, fired }, rng },
    effects,
  }
}
