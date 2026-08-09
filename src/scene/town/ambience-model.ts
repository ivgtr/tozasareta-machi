import { isOnExpedition } from '../../game/actions'
import { BALANCE } from '../../game/data/balance'
import { actOf, type ActId } from '../../game/threat'
import type { GameState } from '../../game/types'

export type TownCondition = 'stable' | 'strained' | 'critical'
export type TownWeather = 'clear' | 'cold' | 'typhoon'

export interface TownAmbienceModel {
  act: ActId
  weather: TownWeather
  power: {
    condition: TownCondition
    ratio: number
    lights: number
  }
  medical: {
    condition: TownCondition
    ratio: number
  }
  morale: {
    condition: TownCondition
    ratio: number
  }
  supplies: {
    foodSecurity: number
    reserveSecurity: number
    foodCrates: number
    reserveCrates: number
  }
  danger: boolean
}

const SIGNAL_STEPS = 4

export function deriveTownAmbience(state: GameState): TownAmbienceModel {
  const powerRatio = ratio(state.resources.power, 100)
  const medicalRatio = ratio(state.resources.medical, 100)
  const moraleRatio = ratio(state.resources.morale, 100)
  const presentUnits = state.units.filter((unit) => !isOnExpedition(unit)).length
  const dailyFoodNeed = presentUnits * BALANCE.unit.foodPerUnit
  const secureFood = dailyFoodNeed * BALANCE.threat.slack.foodDays
  const foodSecurity = ratio(state.resources.food, secureFood)
  const reserveSecurity = ratio(state.stockpile, BALANCE.threat.slack.stockpileAt)
  const powerCondition = condition(
    state.resources.power,
    BALANCE.power.lowAt,
    BALANCE.morale.calmPowerAt,
  )
  const medicalCondition = condition(
    state.resources.medical,
    BALANCE.medical.neglectAt,
    BALANCE.morale.calmMedicalAt,
  )
  const moraleCondition = condition(
    state.resources.morale,
    BALANCE.morale.riotAt,
    BALANCE.skyline.gloomyMoraleBelow,
  )
  const foodCritical = dailyFoodNeed > 0 && state.resources.food < dailyFoodNeed

  return {
    act: actOf(state.day),
    weather: weatherOf(state),
    power: {
      condition: powerCondition,
      ratio: powerRatio,
      lights: signalSteps(powerRatio),
    },
    medical: {
      condition: medicalCondition,
      ratio: medicalRatio,
    },
    morale: {
      condition: moraleCondition,
      ratio: moraleRatio,
    },
    supplies: {
      foodSecurity,
      reserveSecurity,
      foodCrates: signalSteps(foodSecurity),
      reserveCrates: signalSteps(reserveSecurity),
    },
    danger:
      foodCritical ||
      powerCondition === 'critical' ||
      medicalCondition === 'critical' ||
      moraleCondition === 'critical',
  }
}

function weatherOf(state: GameState): TownWeather {
  if (state.modifiers.some((modifier) => modifier.id === 'typhoon')) return 'typhoon'
  if (state.modifiers.some((modifier) => modifier.id === 'cold_snap')) return 'cold'
  return 'clear'
}

function condition(value: number, criticalBelow: number, stableAt: number): TownCondition {
  if (value < criticalBelow) return 'critical'
  if (value < stableAt) return 'strained'
  return 'stable'
}

function ratio(value: number, target: number): number {
  if (target <= 0) return value > 0 ? 1 : 0
  return Math.max(0, Math.min(1, value / target))
}

function signalSteps(value: number): number {
  if (value <= 0) return 0
  return Math.min(SIGNAL_STEPS, Math.max(1, Math.ceil(value * SIGNAL_STEPS)))
}
