import type { GameState } from './types'
import { BALANCE } from './data/balance'

export type ActId = 1 | 2 | 3

export function actOf(day: number): ActId {
  if (day >= BALANCE.acts.final.start) return 3
  if (day >= BALANCE.acts.stalemate.start) return 2
  return 1
}

export interface SlackDetail {
  food: boolean
  power: boolean
  medical: boolean
  morale: boolean
  stockpile: boolean
}

export function slackDetail(state: GameState): SlackDetail {
  const S = BALANCE.threat.slack
  const present = state.units.filter((u) => u.expedition === undefined).length
  return {
    food: state.resources.food >= present * BALANCE.unit.foodPerUnit * S.foodDays,
    power: state.resources.power >= S.powerAt,
    medical: state.resources.medical >= S.medicalAt,
    morale: state.resources.morale >= S.moraleAt,
    stockpile: state.stockpile >= S.stockpileAt,
  }
}

export function slackCount(state: GameState): number {
  const d = slackDetail(state)
  return (
    Number(d.food) + Number(d.power) + Number(d.medical) + Number(d.morale) + Number(d.stockpile)
  )
}

export function threatLevel(state: GameState): number {
  const base = BALANCE.threat.actBase[actOf(state.day) - 1] ?? 0
  return base + slackCount(state)
}

export function threatWeightMult(state: GameState): number {
  return Math.min(1 + BALANCE.threat.scale * threatLevel(state), BALANCE.threat.cap)
}
