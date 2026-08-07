import type { Aptitude, Condition, Unit } from '../game/types'

const APT_ORDER: Aptitude[] = ['labor', 'tech', 'medical', 'charm']

export interface UnitVisualState {
  condition: Condition
  topAptitude: Aptitude
}

export function topAptitude(unit: Unit): Aptitude {
  return APT_ORDER.reduce(
    (best, aptitude) => (unit.apt[aptitude] > unit.apt[best] ? aptitude : best),
    APT_ORDER[0] as Aptitude,
  )
}

export function unitVisualState(unit: Unit): UnitVisualState {
  return { condition: unit.condition, topAptitude: topAptitude(unit) }
}
