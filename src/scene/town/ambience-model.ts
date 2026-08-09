import { isOnExpedition } from '../../game/actions'
import { BALANCE } from '../../game/data/balance'
import { actOf, type ActId } from '../../game/threat'
import type { GameState } from '../../game/types'

export type TownWeather = 'clear' | 'cold' | 'typhoon'

export interface TownAmbienceModel {
  act: ActId
  weather: TownWeather
  powerRatio: number
  danger: boolean
}

export function deriveTownAmbience(state: GameState): TownAmbienceModel {
  const presentUnits = state.units.filter((unit) => !isOnExpedition(unit)).length
  const dailyFoodNeed = presentUnits * BALANCE.unit.foodPerUnit
  const foodCritical = dailyFoodNeed > 0 && state.resources.food < dailyFoodNeed

  return {
    act: actOf(state.day),
    weather: weatherOf(state),
    powerRatio: ratio(state.resources.power, 100),
    danger:
      foodCritical ||
      state.resources.power < BALANCE.power.lowAt ||
      state.resources.medical < BALANCE.medical.neglectAt ||
      state.resources.morale < BALANCE.morale.riotAt,
  }
}

function weatherOf(state: GameState): TownWeather {
  if (state.modifiers.some((modifier) => modifier.id === 'typhoon')) return 'typhoon'
  if (state.modifiers.some((modifier) => modifier.id === 'cold_snap')) return 'cold'
  return 'clear'
}

function ratio(value: number, target: number): number {
  if (target <= 0) return value > 0 ? 1 : 0
  return Math.max(0, Math.min(1, value / target))
}
