import type {
  Effect,
  EffectChannels,
  GameState,
  NoticeEffect,
  NumericFlag,
  StateEffect,
  Unit,
  UnitChange,
} from './types'

const RESOURCE_TARGETS = new Set(['food', 'power', 'medical', 'morale', 'budget', 'stockpile'])
const NUMERIC_FLAGS = new Set<NumericFlag>([
  'daysWithoutMedical',
  'daysFoodCut',
  'casualties',
  'refugeesAccepted',
  'cooperation',
])

function cloneUnit(unit: Unit): Unit {
  return { ...unit, apt: { ...unit.apt }, traits: [...unit.traits] }
}

function sameUnit(a: Unit, b: Unit): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.alias === b.alias &&
    a.unique === b.unique &&
    a.flavor === b.flavor &&
    a.portrait === b.portrait &&
    a.condition === b.condition &&
    a.xp === b.xp &&
    a.expedition === b.expedition &&
    a.apt.labor === b.apt.labor &&
    a.apt.tech === b.apt.tech &&
    a.apt.medical === b.apt.medical &&
    a.apt.charm === b.apt.charm &&
    a.traits.length === b.traits.length &&
    a.traits.every((trait, index) => trait === b.traits[index])
  )
}

function changeUnitId(change: UnitChange): string {
  return change.unit.id
}

export function syncUnitChange(unit: Unit): UnitChange {
  return { kind: 'sync', unit: cloneUnit(unit) }
}

export function removeUnitChange(unit: Unit): UnitChange {
  return { kind: 'remove', unit: cloneUnit(unit) }
}

export function unitChangesBetween(previous: readonly Unit[], next: readonly Unit[]): UnitChange[] {
  const previousById = new Map(previous.map((unit) => [unit.id, unit]))
  const nextById = new Map(next.map((unit) => [unit.id, unit]))
  const changes: UnitChange[] = []

  for (const unit of next) {
    const before = previousById.get(unit.id)
    if (!before || !sameUnit(before, unit)) changes.push(syncUnitChange(unit))
  }
  for (const unit of previous) {
    if (!nextById.has(unit.id)) changes.push(removeUnitChange(unit))
  }
  return changes
}

export function attachUnitChanges(
  effects: readonly Effect[],
  changes: readonly UnitChange[],
): Effect[] {
  if (effects.length === 0 || changes.length === 0) return [...effects]
  let remaining = [...changes]
  const annotated = effects.map((effect) => {
    if (!effect.target.startsWith('unit:')) return effect
    const unitId = effect.target.slice('unit:'.length)
    const matched = remaining.filter((change) => changeUnitId(change) === unitId)
    if (matched.length === 0) return effect
    remaining = remaining.filter((change) => changeUnitId(change) !== unitId)
    return { ...effect, unitChanges: [...(effect.unitChanges ?? []), ...matched] }
  })

  if (remaining.length > 0) {
    const lastIndex = annotated.length - 1
    const last = annotated[lastIndex]!
    annotated[lastIndex] = {
      ...last,
      unitChanges: [...(last.unitChanges ?? []), ...remaining],
    }
  }
  return annotated
}

export function attachUnitChangesToLast(
  effects: readonly Effect[],
  changes: readonly UnitChange[],
): Effect[] {
  if (effects.length === 0 || changes.length === 0) return [...effects]
  const annotated = [...effects]
  const lastIndex = annotated.length - 1
  const last = annotated[lastIndex]!
  annotated[lastIndex] = {
    ...last,
    unitChanges: [...(last.unitChanges ?? []), ...changes],
  }
  return annotated
}

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
