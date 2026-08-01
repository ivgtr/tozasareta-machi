import type { Effect, EffectTarget, GameState, TaskId } from './types'
import { BALANCE } from './data/balance'
import { APTITUDE_LABEL } from './data/units'
import { TASK_APT } from './actions'
import { clamp } from './state'
import { nextRandom } from './rng'

export interface WorkEntry {
  unitId: string
  task: TaskId
}

export interface SettleInput {
  ration: boolean
  worked: WorkEntry[]
}

export interface SettleResult {
  state: GameState
  effects: Effect[]
}

export function settle(prev: GameState, input: SettleInput): SettleResult {
  const B = BALANCE
  const day = prev.day
  const effects: Effect[] = []
  let { food, power, medical, morale } = prev.resources
  let { budget, stockpile } = prev
  let units = prev.units.map((u) => ({ ...u, apt: { ...u.apt }, traits: [...u.traits] }))
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

  for (const u of units) {
    if (u.traits.includes('popular'))
      addMorale(B.trait.popularMorale, `${u.name}の存在が人心を和ませた`)
    if (u.traits.includes('troublemaker'))
      addMorale(B.trait.troublemakerMorale, `${u.name}が揉め事を起こした`)
  }

  const consume = Math.round(units.length * B.unit.foodPerUnit * (input.ration ? 0.5 : 1))
  food -= consume
  eff('food', -consume, input.ration ? '配給を絞り、消費を抑えた' : '人々が食料を消費した')
  if (food < 0 && stockpile > 0) {
    const take = Math.min(stockpile, -food)
    stockpile -= take
    food += take
    eff('stockpile', -take, '備蓄を取り崩して飢えをしのいだ')
  }
  if (food < 0) {
    food = 0
    if (units.length > 0) {
      const [di, r1] = nextRandom(rng)
      rng = r1
      const idx = Math.floor(di * units.length)
      const dead = units[idx]
      units = units.filter((_, i) => i !== idx)
      flags.casualties += 1
      eff('flag:casualties', 1, `食料が尽き、${dead?.name ?? '仲間'}が亡くなった`)
      addMorale(B.morale.hunger, '仲間を飢えで失った')
    } else {
      addMorale(B.morale.hunger, '食料が尽きた')
    }
  }

  power = clamp(power - B.power.decay, 0, 100)
  eff('power', -B.power.decay, '発電設備が劣化した')
  const extra = power < B.medical.lowPowerAt ? B.medical.extraDecay : 0
  const medDecay = B.medical.decay + extra
  medical = clamp(medical - medDecay, 0, 100)
  eff('medical', -medDecay, extra > 0 ? '停電で医療の効率が落ちた' : '医療資源が消費された')

  if (medical >= B.unit.healMedicalAt) {
    for (const u of units) {
      if (u.condition === 'injured') {
        u.condition = 'healthy'
        eff('flag:heal', 0, `${u.name}の怪我が治った`)
      }
    }
  }

  if (medical < B.unit.injuryMedicalBelow) {
    const workedHealthy = input.worked
      .map((w) => units.find((u) => u.id === w.unitId))
      .filter((u): u is NonNullable<typeof u> => u !== undefined && u.condition === 'healthy')
    for (const u of workedHealthy) {
      if (u.traits.includes('sturdy')) continue
      let chance = B.unit.injuryChance
      if (u.traits.includes('clumsy')) chance *= 2
      const [iv, r2] = nextRandom(rng)
      rng = r2
      if (iv < chance) {
        u.condition = 'injured'
        eff('flag:injury', 0, `${u.name}が怪我を負った（効果半減）`)
      }
    }
  }

  for (const w of input.worked) {
    const u = units.find((x) => x.id === w.unitId)
    if (!u) continue
    u.xp += 1
    if (u.xp >= B.unit.growthThreshold) {
      u.xp -= B.unit.growthThreshold
      const apt = TASK_APT[w.task]
      if (apt && u.apt[apt] < 10) {
        u.apt[apt] += 1
        eff('flag:growth', 0, `${u.name}が成長した（${APTITUDE_LABEL[apt]}+1）`)
      }
    }
  }

  flags.daysWithoutMedical = medical < B.medical.neglectAt ? flags.daysWithoutMedical + 1 : 0
  flags.daysFoodCut = input.ration ? flags.daysFoodCut + 1 : 0

  if (input.ration) addMorale(B.morale.ration, '配給を絞ったため、不満が高まった')
  if (food < units.length * B.unit.foodPerUnit * B.morale.lowFoodDays)
    addMorale(B.morale.lowFood, '食料の残りが少なく、不安が広がった')
  if (medical < B.medical.neglectAt) addMorale(B.morale.lowMedical, '医療体制への不安が広がった')
  if (power < 30) addMorale(B.morale.lowPower, '暗闇への不満が広がった')
  if (
    food >= units.length * B.unit.foodPerUnit * B.morale.lowFoodDays &&
    medical >= B.morale.calmMedicalAt &&
    power >= B.morale.calmPowerAt
  )
    addMorale(B.morale.calm, '穏やかな一日だった')

  if (morale >= B.morale.coopAt) {
    flags.cooperation += 1
    eff('flag:cooperation', 1, '住民同士の協力が深まった')
  }

  if (morale < B.unit.desertionMoraleBelow && units.length > 0) {
    const [lv, r3] = nextRandom(rng)
    rng = r3
    if (lv < B.unit.desertionChance) {
      const [di, r4] = nextRandom(rng)
      rng = r4
      const idx = Math.floor(di * units.length)
      const left = units[idx]
      units = units.filter((_, i) => i !== idx)
      eff('flag:desert', 0, `${left?.name ?? '仲間'}が町を去った`)
      addMorale(B.morale.desertionRecover, '残った者たちで気持ちを引き締めた')
    }
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
      units,
      flags,
      rng,
    },
    effects,
  }
}
