import { BALANCE, SAVE_VERSION } from './data/balance'
import type { Aptitude, GameState, NumericFlag } from './types'

const APTITUDES: Aptitude[] = ['labor', 'tech', 'medical', 'charm']
const NUMERIC_FLAGS: NumericFlag[] = [
  'daysWithoutMedical',
  'daysFoodCut',
  'casualties',
  'refugeesAccepted',
  'cooperation',
]

function isFiniteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0
}

function isUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

export function isGameStateSemanticallyValid(state: GameState): boolean {
  if (state.version !== SAVE_VERSION) return false
  if (!Number.isInteger(state.day) || state.day < 1 || state.day > BALANCE.days + 1) return false

  const { food, power, medical, morale } = state.resources
  if (!isFiniteNonNegative(food)) return false
  if (!Number.isFinite(power) || power < 0 || power > 100) return false
  if (!Number.isFinite(medical) || medical < 0 || medical > 100) return false
  if (!Number.isFinite(morale) || morale < 0 || morale > 100) return false
  if (!isFiniteNonNegative(state.budget) || !isFiniteNonNegative(state.stockpile)) return false

  if (state.units.length > BALANCE.unit.cap) return false
  const unitIds = state.units.map((unit) => unit.id)
  if (!isUnique(unitIds) || unitIds.some((id) => id.length === 0)) return false
  for (const unit of state.units) {
    if (!unit.name || !unit.portrait) return false
    if (!Number.isInteger(unit.xp) || unit.xp < 0 || unit.xp >= BALANCE.unit.growthThreshold) {
      return false
    }
    if (
      unit.expedition !== undefined &&
      (!Number.isInteger(unit.expedition) || unit.expedition < 1 || unit.expedition > state.day)
    ) {
      return false
    }
    if (!isUnique(unit.traits)) return false
    for (const aptitude of APTITUDES) {
      const value = unit.apt[aptitude]
      if (!Number.isInteger(value) || value < 0 || value > 10) return false
    }
  }

  for (const key of NUMERIC_FLAGS) {
    const value = state.flags[key]
    if (!Number.isInteger(value) || value < 0) return false
  }
  if (!isUnique(state.flags.fired) || !isUnique(state.flags.joinedUniques)) return false

  if (!Number.isInteger(state.rng.seed)) return false
  if (!Number.isInteger(state.rng.counter) || state.rng.counter < 0) return false

  const modifierIds = state.modifiers.map((modifier) => modifier.id)
  if (!isUnique(modifierIds)) return false
  for (const modifier of state.modifiers) {
    if (!modifier.id) return false
    if (!Number.isInteger(modifier.daysLeft) || modifier.daysLeft <= 0) return false
    if (
      !Number.isInteger(modifier.startDay) ||
      modifier.startDay < 1 ||
      modifier.startDay > BALANCE.days
    ) {
      return false
    }
    if (modifier.effects.some((effect) => !Number.isFinite(effect.value))) return false
  }

  if (
    state.report.some(
      (effect) =>
        !Number.isInteger(effect.day) ||
        effect.day < 1 ||
        effect.day > BALANCE.days ||
        !Number.isFinite(effect.delta),
    )
  ) {
    return false
  }

  if (state.phase === 'choice') {
    if (state.ending !== undefined || state.day > BALANCE.days) return false
    if (!state.pendingChoice || !state.pendingChoice.eventId) return false
    if (state.pendingChoice.optionIds.length === 0 || !isUnique(state.pendingChoice.optionIds)) {
      return false
    }
    return true
  }

  if (state.pendingChoice !== undefined || state.pendingEvents !== undefined) return false
  if (state.phase === 'planning') return state.ending === undefined && state.day <= BALANCE.days
  return state.ending !== undefined
}
