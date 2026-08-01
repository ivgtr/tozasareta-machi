import type { Action, Effect, GameState, NumericFlag, StepResult } from './types'
import { BALANCE } from './data/balance'
import { resolvePlacement, sanitizePlan } from './actions'
import { settle, type WorkEntry } from './settlement'
import { runEvents } from './events'
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

export function step(prev: GameState, action: Action): StepResult {
  if (prev.phase === 'ended') return { state: prev, effects: [] }

  const plan = sanitizePlan(prev, action.plan)
  const effects: Effect[] = []
  for (const p of plan.placements) effects.push(...resolvePlacement(prev, p))
  let s = applyEffects(prev, effects)

  const worked: WorkEntry[] = plan.placements.flatMap((p) =>
    p.unitIds.map((unitId) => ({ unitId, task: p.task })),
  )
  const settled = settle(s, { ration: plan.ration, worked })
  s = settled.state
  effects.push(...settled.effects)

  const ev = runEvents(s)
  s = ev.state
  effects.push(...ev.effects)
  s = applyEffects(s, ev.effects)

  const day = s.day + 1
  let phase = s.phase
  let ending = s.ending
  if (checkCollapse(s)) {
    phase = 'ended'
    ending = 'collapse'
  } else if (day > BALANCE.days) {
    phase = 'ended'
    ending = evaluate(s)
  }

  s = { ...s, day, phase, ending, report: effects }
  return { state: s, effects }
}
