import type { Action, DayPlan, Effect, GameState, NumericFlag, Phase, StepResult } from './types'
import { BALANCE } from './data/balance'
import { resolvePlacement, sanitizePlan } from './actions'
import { settle, type WorkEntry } from './settlement'
import {
  applyAutoEvent,
  applyChoiceOption,
  choiceOptions,
  determineDayEvents,
  findEvent,
} from './events'
import { checkCollapse, evaluate } from './ending'

const NUMERIC_FLAGS: NumericFlag[] = [
  'daysWithoutMedical',
  'daysFoodCut',
  'casualties',
  'refugeesAccepted',
  'cooperation',
]

export function applyEffects(prev: GameState, effects: Effect[]): GameState {
  let { food, power, medical, morale } = prev.resources
  let { budget, stockpile } = prev
  const flags = { ...prev.flags, fired: [...prev.flags.fired] }

  for (const e of effects) {
    const t = e.target
    switch (t) {
      case 'food':
        food = Math.max(0, food + e.delta)
        break
      case 'power':
        power = Math.max(0, Math.min(100, power + e.delta))
        break
      case 'medical':
        medical = Math.max(0, Math.min(100, medical + e.delta))
        break
      case 'morale':
        morale = Math.max(0, Math.min(100, morale + e.delta))
        break
      case 'budget':
        budget = Math.max(0, budget + e.delta)
        break
      case 'stockpile':
        stockpile = Math.max(0, stockpile + e.delta)
        break
      default: {
        if (t.startsWith('flag:')) {
          const key = t.slice('flag:'.length)
          if ((NUMERIC_FLAGS as readonly string[]).includes(key)) {
            const k = key as NumericFlag
            flags[k] = flags[k] + e.delta
          }
        }
      }
    }
  }
  return { ...prev, resources: { food, power, medical, morale }, budget, stockpile, flags }
}

function finalizeDay(s: GameState, produced: Effect[]): StepResult {
  const day = s.day + 1
  let phase: Phase = 'planning'
  let ending = s.ending
  if (checkCollapse(s)) {
    phase = 'ended'
    ending = 'collapse'
  } else if (day > BALANCE.days) {
    phase = 'ended'
    ending = evaluate(s)
  }
  const state: GameState = {
    ...s,
    day,
    phase,
    ending,
    pendingEvents: undefined,
    pendingChoice: undefined,
  }
  return { state, effects: produced }
}

function appendReport(st: GameState, fx: Effect[]): GameState {
  return { ...st, report: [...(st.report ?? []), ...fx] }
}

function processQueue(input: GameState): StepResult {
  let s = input
  const produced: Effect[] = []

  while (s.pendingEvents && s.pendingEvents.length > 0) {
    const eventId = s.pendingEvents[0]
    const rest = s.pendingEvents.slice(1)
    if (!eventId) {
      s = { ...s, pendingEvents: rest }
      continue
    }
    const event = findEvent(eventId)
    if (!event) {
      s = { ...s, pendingEvents: rest }
      continue
    }

    if ((event.kind ?? 'auto') === 'auto') {
      const res = applyAutoEvent(s, event)
      const applied = applyEffects(res.state, res.effects)
      produced.push(...res.effects)
      s = appendReport({ ...applied, pendingEvents: rest }, res.effects)
      continue
    }

    const opts = choiceOptions(s, event)
    if (opts.length === 0) {
      let ns: GameState = { ...s, pendingEvents: rest }
      if (event.once) ns = { ...ns, flags: { ...ns.flags, fired: [...ns.flags.fired, event.id] } }
      s = ns
      continue
    }

    s = {
      ...s,
      pendingEvents: rest,
      pendingChoice: { eventId, optionIds: opts.map((o) => o.id) },
      phase: 'choice',
    }
    return { state: s, effects: produced }
  }

  return finalizeDay(s, produced)
}

function commitDayStep(prev: GameState, plan: DayPlan): StepResult {
  const produced: Effect[] = []
  const sanitized = sanitizePlan(prev, plan)
  for (const p of sanitized.placements) produced.push(...resolvePlacement(prev, p))
  let s = applyEffects(prev, produced)

  const worked: WorkEntry[] = sanitized.placements.flatMap((p) =>
    p.unitIds.map((unitId) => ({ unitId, task: p.task })),
  )
  const settled = settle(s, { ration: sanitized.ration, worked })
  s = settled.state
  produced.push(...settled.effects)

  const { eventIds, rng } = determineDayEvents(s)
  s = { ...s, rng, pendingEvents: eventIds, pendingChoice: undefined, report: [...produced] }

  const result = processQueue(s)
  return { state: result.state, effects: [...produced, ...result.effects] }
}

function resolveChoiceStep(prev: GameState, optionId: string): StepResult {
  if (prev.phase !== 'choice' || !prev.pendingChoice) return { state: prev, effects: [] }
  const event = findEvent(prev.pendingChoice.eventId)
  if (!event) {
    return { state: { ...prev, phase: 'planning', pendingChoice: undefined }, effects: [] }
  }
  const option = choiceOptions(prev, event).find((o) => o.id === optionId)
  if (!option) return { state: prev, effects: [] }

  const res = applyChoiceOption(prev, event, option)
  const applied = applyEffects(res.state, res.effects)
  const produced = [...res.effects]
  const s = appendReport({ ...applied, pendingChoice: undefined }, res.effects)

  const result = processQueue(s)
  return { state: result.state, effects: [...produced, ...result.effects] }
}

export function step(prev: GameState, action: Action): StepResult {
  if (prev.phase === 'ended') return { state: prev, effects: [] }
  if (action.type === 'resolveChoice') return resolveChoiceStep(prev, action.optionId)
  if (prev.phase !== 'planning') return { state: prev, effects: [] }
  return commitDayStep(prev, action.plan)
}
