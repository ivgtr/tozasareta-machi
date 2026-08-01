import type { ChoiceOption, Effect, EvalContext, EventDef, GameState, RngState } from './types'
import { BALANCE } from './data/balance'
import { EVENTS } from './data/events-data'
import { chance, weightedPick } from './rng'

export interface RunEventsResult {
  state: GameState
  effects: Effect[]
}

function makeCtx(state: GameState): EvalContext {
  return { state, flags: state.flags, day: state.day }
}

function eligible(e: EventDef, state: GameState, ctx: EvalContext): boolean {
  return (!e.once || !state.flags.fired.includes(e.id)) && e.when(ctx) && e.weight(ctx) > 0
}

function isChoice(e: EventDef): boolean {
  return e.kind === 'choice'
}

export function findEvent(id: string): EventDef | undefined {
  return EVENTS.find((e) => e.id === id)
}

export function determineDayEvents(prev: GameState): { eventIds: string[]; rng: RngState } {
  const ctx = makeCtx(prev)
  let rng = prev.rng
  const eventIds: string[] = []

  const autoCands = EVENTS.filter((e) => !isChoice(e) && eligible(e, prev, ctx))
  if (autoCands.length > 0) {
    const picked = weightedPick(autoCands, (e) => e.weight(ctx), rng)
    if (picked) {
      eventIds.push(picked[0].id)
      rng = picked[1]
    }
  }

  const choiceCands = EVENTS.filter((e) => isChoice(e) && eligible(e, prev, ctx))
  if (choiceCands.length > 0) {
    const [fires, r1] = chance(rng, BALANCE.event.choiceChance)
    rng = r1
    if (fires) {
      const picked = weightedPick(choiceCands, (e) => e.weight(ctx), rng)
      if (picked) {
        eventIds.push(picked[0].id)
        rng = picked[1]
      }
    }
  }

  return { eventIds, rng }
}

export function applyAutoEvent(prev: GameState, event: EventDef): RunEventsResult {
  const ctx = makeCtx(prev)
  let state = prev
  let effects: Effect[]
  if (event.mutate) {
    const res = event.mutate(state)
    state = res.state
    effects = res.effects
  } else {
    effects = event.apply ? event.apply(ctx) : []
  }
  if (event.once) {
    state = { ...state, flags: { ...state.flags, fired: [...state.flags.fired, event.id] } }
  }
  return { state, effects }
}

export function choiceOptions(state: GameState, event: EventDef): ChoiceOption[] {
  const ctx = makeCtx(state)
  const perUnit = event.perUnit ? state.units.map((u) => event.perUnit!(u, ctx)) : []
  const statics = (event.choices ?? []).filter((o) => !o.when || o.when(ctx))
  return [...perUnit, ...statics]
}

export function applyChoiceOption(
  prev: GameState,
  event: EventDef,
  option: ChoiceOption,
): RunEventsResult {
  const ctx = makeCtx(prev)
  let state = prev
  let effects: Effect[]
  if (option.mutate) {
    const res = option.mutate(state)
    state = res.state
    effects = res.effects
  } else {
    effects = option.apply ? option.apply(ctx) : []
  }
  if (event.once) {
    state = { ...state, flags: { ...state.flags, fired: [...state.flags.fired, event.id] } }
  }
  return { state, effects }
}

export function runEvents(prev: GameState): RunEventsResult {
  const ctx = makeCtx(prev)
  const candidates = EVENTS.filter((e) => !isChoice(e) && eligible(e, prev, ctx))
  if (candidates.length === 0) return { state: prev, effects: [] }
  const picked = weightedPick(candidates, (e) => e.weight(ctx), prev.rng)
  if (!picked) return { state: prev, effects: [] }
  const [event, rng] = picked
  return applyAutoEvent({ ...prev, rng }, event)
}
