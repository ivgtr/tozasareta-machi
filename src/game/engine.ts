import type { Action, Effect, EffectTarget, GameState, NumericFlag, StepResult } from './types'
import { BALANCE } from './data/balance'
import { availableWorkers, clamp } from './state'
import { resolveAssignment, sanitizePlan } from './actions'
import { settle } from './settlement'
import { runEvents } from './events'
import { checkCollapse, evaluate } from './ending'

const NUMERIC_FLAGS = [
  'daysWithoutMedical',
  'daysFoodCut',
  'casualties',
  'refugeesAccepted',
  'cooperation',
] as const

export function applyEffects(prev: GameState, effects: Effect[]): GameState {
  let { food, power, medical, morale } = prev.resources
  let { workers, budget, stockpile } = prev
  const flags = { ...prev.flags, fired: [...prev.flags.fired] }

  for (const e of effects) {
    const t: EffectTarget = e.target
    switch (t) {
      case 'food':
        food = Math.max(0, food + e.delta)
        break
      case 'power':
        power = clamp(power + e.delta, 0, 100)
        break
      case 'medical':
        medical = clamp(medical + e.delta, 0, 100)
        break
      case 'morale':
        morale = clamp(morale + e.delta, 0, 100)
        break
      case 'budget':
        budget = Math.max(0, budget + e.delta)
        break
      case 'stockpile':
        stockpile = Math.max(0, stockpile + e.delta)
        break
      case 'workers':
        workers = Math.max(0, workers + e.delta)
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
  return {
    ...prev,
    resources: { food, power, medical, morale },
    workers,
    budget,
    stockpile,
    flags,
  }
}

export function step(prev: GameState, action: Action): StepResult {
  if (prev.phase === 'ended') return { state: prev, effects: [] }

  const plan = sanitizePlan(prev, action.plan)
  const effects: Effect[] = []
  const rationed = plan.assignments.some((a) => a.task === 'ration')

  for (const a of plan.assignments) effects.push(...resolveAssignment(prev, a))
  let s = applyEffects(prev, effects)

  const settled = settle(s, rationed)
  s = settled.state
  effects.push(...settled.effects)

  const ev = runEvents(s)
  s = ev.state
  effects.push(...ev.effects)
  s = applyEffects(s, ev.effects)

  const day = s.day + 1
  const workers = availableWorkers(s.resources.morale)
  let phase = s.phase
  let ending = s.ending
  if (checkCollapse(s)) {
    phase = 'ended'
    ending = 'collapse'
  } else if (day > BALANCE.days) {
    phase = 'ended'
    ending = evaluate(s)
  }

  s = { ...s, day, workers, phase, ending, report: effects }
  return { state: s, effects }
}
