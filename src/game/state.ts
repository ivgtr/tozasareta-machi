import type { GameState } from './types'
import { BALANCE, SAVE_VERSION } from './data/balance'
import { INITIAL_UNITS, cloneUnit } from './data/units'

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function createInitialState(seed: number): GameState {
  return {
    version: SAVE_VERSION,
    day: 1,
    phase: 'planning',
    resources: {
      food: BALANCE.food.start,
      power: BALANCE.power.start,
      medical: BALANCE.medical.start,
      morale: BALANCE.morale.start,
    },
    budget: BALANCE.budget.start,
    stockpile: BALANCE.stockpile.start,
    units: INITIAL_UNITS.map((u) => cloneUnit(u)),
    flags: {
      daysWithoutMedical: 0,
      daysFoodCut: 0,
      casualties: 0,
      refugeesAccepted: 0,
      cooperation: 0,
      fired: [],
      joinedUniques: [],
    },
    rng: { seed, counter: 0 },
    report: [],
    modifiers: [],
  }
}
