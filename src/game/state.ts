import type { GameState } from './types'
import { BALANCE, SAVE_VERSION } from './data/balance'
import { INITIAL_CHARACTERS } from './data/characters'

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function availableWorkers(morale: number): number {
  const w = BALANCE.workers
  let n = w.base
  if (morale >= w.volunteer) n += 1
  if (morale < w.penaltyA) n -= 1
  if (morale < w.penaltyB) n -= 1
  return Math.max(w.min, n)
}

export function createInitialState(seed: number): GameState {
  const morale = BALANCE.morale.start
  return {
    version: SAVE_VERSION,
    day: 1,
    phase: 'planning',
    resources: {
      food: BALANCE.food.start,
      power: BALANCE.power.start,
      medical: BALANCE.medical.start,
      morale,
    },
    workers: availableWorkers(morale),
    budget: BALANCE.budget.start,
    stockpile: BALANCE.stockpile.start,
    characters: INITIAL_CHARACTERS.map((c) => ({ ...c })),
    flags: {
      daysWithoutMedical: 0,
      daysFoodCut: 0,
      casualties: 0,
      refugeesAccepted: 0,
      cooperation: 0,
      fired: [],
    },
    rng: { seed, counter: 0 },
    report: [],
  }
}

export function moraleLabel(morale: number): string {
  if (morale >= 80) return '住民は協力的'
  if (morale >= 40) return '不安が広がっている'
  if (morale >= 20) return '不満が表面化している'
  return '暴動の危険がある'
}
