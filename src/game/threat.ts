import type { GameState } from './types'
import { BALANCE } from './data/balance'

export type ActId = 1 | 2 | 3

export function actOf(day: number): ActId {
  if (day >= BALANCE.acts.final.start) return 3
  if (day >= BALANCE.acts.stalemate.start) return 2
  return 1
}

export function slackCount(state: GameState): number {
  const S = BALANCE.threat.slack
  const present = state.units.filter((u) => u.expedition === undefined).length
  let count = 0
  if (state.resources.food >= present * BALANCE.unit.foodPerUnit * S.foodDays) count += 1
  if (state.resources.power >= S.powerAt) count += 1
  if (state.resources.medical >= S.medicalAt) count += 1
  if (state.resources.morale >= S.moraleAt) count += 1
  if (state.stockpile >= S.stockpileAt) count += 1
  return count
}

export function threatLevel(state: GameState): number {
  const base = BALANCE.threat.actBase[actOf(state.day) - 1] ?? 0
  return base + slackCount(state)
}

export function threatWeightMult(state: GameState): number {
  return Math.min(1 + BALANCE.threat.scale * threatLevel(state), BALANCE.threat.cap)
}
