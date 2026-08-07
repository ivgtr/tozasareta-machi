import type { ChoiceOption, Effect, EvalContext, EventDef, GameState, RngState } from './types'
import { BALANCE } from './data/balance'
import { EVENTS } from './data/events-data'
import { chance, weightedPick } from './rng'
import { threatWeightMult } from './threat'
import { applyEffects } from './effects'

export interface RunEventsResult {
  state: GameState
  effects: Effect[]
}

export interface EventPickResult {
  eventId?: string
  rng: RngState
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

export function isEventEligible(state: GameState, event: EventDef): boolean {
  return eligible(event, state, makeCtx(state))
}

export function determineAutoEvent(prev: GameState): EventPickResult {
  const ctx = makeCtx(prev)
  const candidates = EVENTS.filter((event) => !isChoice(event) && eligible(event, prev, ctx))
  if (candidates.length === 0) return { rng: prev.rng }

  const mult = threatWeightMult(prev)
  const picked = weightedPick(
    candidates,
    (event) => (event.tone === 'threat' ? event.weight(ctx) * mult : event.weight(ctx)),
    prev.rng,
  )
  return picked ? { eventId: picked[0].id, rng: picked[1] } : { rng: prev.rng }
}

export function determineChoiceEvent(prev: GameState): EventPickResult {
  const ctx = makeCtx(prev)
  const candidates = EVENTS.filter((event) => isChoice(event) && eligible(event, prev, ctx))
  if (candidates.length === 0) return { rng: prev.rng }

  const [fires, afterChance] = chance(prev.rng, BALANCE.event.choiceChance)
  if (!fires) return { rng: afterChance }

  const picked = weightedPick(candidates, (event) => event.weight(ctx), afterChance)
  return picked ? { eventId: picked[0].id, rng: picked[1] } : { rng: afterChance }
}

export function determineDayEvents(prev: GameState): { eventIds: string[]; rng: RngState } {
  const eventIds: string[] = []
  const auto = determineAutoEvent(prev)
  let state = { ...prev, rng: auto.rng }

  if (auto.eventId) {
    eventIds.push(auto.eventId)
    const event = findEvent(auto.eventId)
    if (event) {
      const result = applyAutoEvent(state, event)
      state = applyEffects(result.state, result.effects)
    }
  }

  const choice = determineChoiceEvent(state)
  if (choice.eventId) eventIds.push(choice.eventId)
  return { eventIds, rng: choice.rng }
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
  const perUnit = event.perUnit
    ? state.units.map((u) => event.perUnit!(u, ctx)).filter((o) => !o.when || o.when(ctx))
    : []
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
