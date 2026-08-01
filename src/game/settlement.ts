import type { Effect, EffectTarget, GameState } from './types'
import { BALANCE } from './data/balance'
import { chance } from './rng'
import { clamp } from './state'

export interface SettleResult {
  state: GameState
  effects: Effect[]
}

export function settle(prev: GameState, rationed: boolean): SettleResult {
  const B = BALANCE
  const day = prev.day
  const effects: Effect[] = []
  let { food, power, medical, morale } = prev.resources
  let { budget, stockpile } = prev
  const flags = { ...prev.flags, fired: [...prev.flags.fired] }
  let rng = prev.rng

  const eff = (target: EffectTarget, delta: number, reason: string) =>
    effects.push({ day, source: 'settlement', target, delta, reason })
  const addMorale = (delta: number, reason: string) => {
    const before = morale
    morale = clamp(morale + delta, 0, 100)
    const actual = morale - before
    if (actual !== 0) eff('morale', actual, reason)
  }

  const bonus = power >= B.budget.bonusAt ? B.budget.bonus : 0
  const income = B.budget.income + bonus
  budget += income
  eff('budget', income, bonus > 0 ? '電力が安定し、商業から予算を得た' : '町の活動から予算を得た')

  const consume = Math.round(B.food.consume * (rationed ? 0.5 : 1))
  food -= consume
  eff('food', -consume, rationed ? '配給を絞り、消費を抑えた' : '住民が食料を消費した')
  if (food < 0 && stockpile > 0) {
    const take = Math.min(stockpile, -food)
    stockpile -= take
    food += take
    eff('stockpile', -take, '備蓄を取り崩して飢えをしのいだ')
  }
  if (food < 0) {
    const loss = Math.ceil(-food / 10)
    food = 0
    flags.casualties += loss
    addMorale(B.morale.hunger, '食料が尽き、犠牲が出た')
  }

  power = clamp(power - B.power.decay, 0, 100)
  eff('power', -B.power.decay, '発電設備が劣化した')
  const extra = power < B.medical.lowPowerAt ? B.medical.extraDecay : 0
  const medDecay = B.medical.decay + extra
  medical = clamp(medical - medDecay, 0, 100)
  eff('medical', -medDecay, extra > 0 ? '停電で医療の効率が落ちた' : '医療資源が消費された')

  flags.daysWithoutMedical = medical < B.medical.neglectAt ? flags.daysWithoutMedical + 1 : 0
  if (medical < B.medical.casualtyAt) {
    const [hit, next] = chance(rng, B.medical.casualtyP)
    rng = next
    if (hit) {
      flags.casualties += 1
      addMorale(B.morale.casualtyMorale, '医療不足で犠牲が出た')
    }
  }

  flags.daysFoodCut = rationed ? flags.daysFoodCut + 1 : 0
  if (rationed) addMorale(B.morale.ration, '配給を絞ったため、不満が高まった')
  if (food < B.food.consume * B.morale.lowFoodDays)
    addMorale(B.morale.lowFood, '食料の残りが少なく、不安が広がった')
  if (medical < B.medical.neglectAt) addMorale(B.morale.lowMedical, '医療体制への不安が広がった')
  if (power < 30) addMorale(B.morale.lowPower, '暗闇への不満が広がった')
  if (
    food >= B.food.consume * B.morale.lowFoodDays &&
    medical >= B.morale.calmMedicalAt &&
    power >= B.morale.calmPowerAt
  )
    addMorale(B.morale.calm, '穏やかな一日だった')

  if (morale >= B.morale.coopAt) {
    flags.cooperation += 1
    eff('flag:cooperation', 1, '住民同士の協力が深まった')
  }
  if (morale < B.morale.riotAt) {
    const loss = Math.min(budget, B.morale.riotBudgetLoss)
    budget -= loss
    if (loss > 0) eff('budget', -loss, '住民の不満が爆発し、作業が滞った')
  }

  return {
    state: {
      ...prev,
      resources: { food, power, medical, morale },
      budget,
      stockpile,
      flags,
      rng,
    },
    effects,
  }
}
