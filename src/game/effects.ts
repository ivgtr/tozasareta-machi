import type {
  Effect,
  EffectChannels,
  GameState,
  NoticeEffect,
  NumericFlag,
  StateEffect,
} from './types'

const RESOURCE_TARGETS = new Set(['food', 'power', 'medical', 'morale', 'budget', 'stockpile'])
const NUMERIC_FLAGS = new Set<NumericFlag>([
  'daysWithoutMedical',
  'daysFoodCut',
  'casualties',
  'refugeesAccepted',
  'cooperation',
])

export function isStateEffect(effect: Effect): effect is StateEffect {
  if (RESOURCE_TARGETS.has(effect.target)) return true
  if (!effect.target.startsWith('flag:')) return false
  return NUMERIC_FLAGS.has(effect.target.slice('flag:'.length) as NumericFlag)
}

export function splitEffects(effects: readonly Effect[]): EffectChannels {
  const stateChanges: StateEffect[] = []
  const notices: NoticeEffect[] = []
  for (const effect of effects) {
    if (isStateEffect(effect)) stateChanges.push(effect)
    else notices.push(effect as NoticeEffect)
  }
  return { stateChanges, notices }
}

export function applyEffects(prev: GameState, effects: readonly Effect[]): GameState {
  let { food, power, medical, morale } = prev.resources
  let { budget, stockpile } = prev
  const flags = { ...prev.flags, fired: [...prev.flags.fired] }

  for (const effect of splitEffects(effects).stateChanges) {
    switch (effect.target) {
      case 'food':
        food = Math.max(0, food + effect.delta)
        break
      case 'power':
        power = Math.max(0, Math.min(100, power + effect.delta))
        break
      case 'medical':
        medical = Math.max(0, Math.min(100, medical + effect.delta))
        break
      case 'morale':
        morale = Math.max(0, Math.min(100, morale + effect.delta))
        break
      case 'budget':
        budget = Math.max(0, budget + effect.delta)
        break
      case 'stockpile':
        stockpile = Math.max(0, stockpile + effect.delta)
        break
      default: {
        const key = effect.target.slice('flag:'.length) as NumericFlag
        flags[key] += effect.delta
      }
    }
  }

  return {
    ...prev,
    resources: { food, power, medical, morale },
    budget,
    stockpile,
    flags,
  }
}
