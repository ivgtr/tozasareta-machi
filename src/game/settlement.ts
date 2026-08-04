import type { Effect, EffectTarget, GameState, TaskId } from './types'
import { BALANCE } from './data/balance'
import { APTITUDE_LABEL } from './data/units'
import { TASK_APT } from './actions'
import { clamp } from './state'
import { nextRandom } from './rng'
import { queryAdd, queryMult } from './modifiers'

export const EXPEDITION_RETURN_SOURCE = 'event:expedition_return'

export interface WorkEntry {
  unitId: string
  task: TaskId
}

export interface SettleInput {
  ration: boolean
  procure: boolean
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

  const eff = (target: EffectTarget, delta: number, reason: string, source = 'settlement') =>
    effects.push({ day, source, target, delta, reason })
  const addMorale = (delta: number, reason: string) => {
    const before = morale
    morale = clamp(morale + delta, 0, 100)
    const actual = morale - before
    if (actual !== 0) eff('morale', actual, reason)
  }

  const bonus = power >= B.budget.bonusAt ? B.budget.bonus : 0
  const incomeMult = queryMult(prev.modifiers, 'income:budget')
  const income = Math.round((B.budget.income + bonus) * incomeMult)
  budget += income
  eff('budget', income, bonus > 0 ? '電力が安定し、商業から予算を得た' : '町の活動から予算を得た')

  if (input.procure && budget >= B.procure.budget) {
    budget -= B.procure.budget
    stockpile += B.procure.stockpile
    eff('budget', -B.procure.budget, '備蓄の調達に予算を使った')
    eff('stockpile', B.procure.stockpile, '備蓄を調達した')
  }

  const isAway = (u: { expedition?: number }) => u.expedition !== undefined

  for (const u of units) {
    if (isAway(u)) continue
    if (u.traits.includes('popular'))
      addMorale(B.trait.popularMorale, `${u.name}の存在が人心を和ませた`)
    if (u.traits.includes('troublemaker'))
      addMorale(B.trait.troublemakerMorale, `${u.name}が揉め事を起こした`)
  }

  const presentCount = units.filter((u) => !isAway(u)).length
  const consumeMult = queryMult(prev.modifiers, 'consume:food')
  const consume = Math.round(
    presentCount * B.unit.foodPerUnit * (input.ration ? 0.5 : 1) * consumeMult,
  )
  food -= consume
  eff('food', -consume, input.ration ? '配給を絞り、消費を抑えた' : '人々が食料を消費した')
  const foodDecay = Math.round(B.food.decay * queryMult(prev.modifiers, 'decay:food'))
  food -= foodDecay
  eff('food', -foodDecay, '食料が劣化した')
  if (food < 0 && stockpile > 0) {
    const take = Math.min(stockpile, -food)
    stockpile -= take
    food += take
    eff('stockpile', -take, '備蓄を取り崩して飢えをしのいだ')
  }
  if (food < 0) {
    food = 0
    const present = units.filter((u) => !isAway(u))
    if (present.length > 0) {
      const [di, r1] = nextRandom(rng)
      rng = r1
      const idx = Math.floor(di * present.length)
      const dead = present[idx]
      units = units.filter((u) => u.id !== dead?.id)
      flags.casualties += 1
      eff('flag:casualties', 1, `食料が尽き、${dead?.name ?? '仲間'}が亡くなった`)
      addMorale(B.morale.hunger, '仲間を飢えで失った')
    } else {
      addMorale(B.morale.hunger, '食料が尽きた')
    }
  }

  for (const u of [...units]) {
    if (u.expedition === undefined) continue
    const E = B.expedition
    const daysAway = day - u.expedition
    if (daysAway < E.minDays) continue
    const [retRoll, rr] = nextRandom(rng)
    rng = rr
    const returnChance = Math.min(
      E.returnBase + (daysAway - E.minDays) * E.returnPerDay,
      E.returnCap,
    )
    if (retRoll >= returnChance) continue

    const aptMax = Math.max(u.apt.labor, u.apt.tech, u.apt.medical, u.apt.charm)
    const t = Math.max(0, Math.min(1, (aptMax / 10 - 0.2) / 0.8))
    const greatChance = E.greatAtMin + t * (E.greatAtMax - E.greatAtMin)
    const successChance = E.successAtMin + t * (E.successAtMax - E.successAtMin)
    const dangerChance = E.dangerAtMin + t * (E.dangerAtMax - E.dangerAtMin)

    const [roll, ra] = nextRandom(rng)
    rng = ra
    const dailyYield = aptMax * E.rewardCoef
    const daysMult = 1 + Math.max(0, daysAway - E.minDays) * E.returnBonusPerDay

    const SRC = EXPEDITION_RETURN_SOURCE
    if (roll < greatChance) {
      const [vr, rb] = nextRandom(rng)
      rng = rb
      const variance = 0.7 + vr * 0.6
      const foodGain = Math.round(dailyYield * E.greatDays * daysMult * variance)
      const stockGain = Math.round(dailyYield * 2 * daysMult * variance)
      const budgetGain = Math.round(dailyYield * 1.5 * daysMult * variance)
      food += foodGain
      stockpile += stockGain
      budget += budgetGain
      eff(`unit:${u.id}`, 0, `${u.name}が探索から帰還した`, SRC)
      eff('food', foodGain, `${u.name}が探索で大成功——食料を持ち帰った`, SRC)
      eff('stockpile', stockGain, `${u.name}が備蓄を持ち帰った`, SRC)
      eff('budget', budgetGain, `${u.name}が物資を売り予算を得た`, SRC)
    } else if (roll < greatChance + successChance) {
      const [vr, rb] = nextRandom(rng)
      rng = rb
      const variance = 0.7 + vr * 0.6
      const foodGain = Math.round(dailyYield * daysMult * variance)
      food += foodGain
      eff(`unit:${u.id}`, 0, `${u.name}が探索から帰還した`, SRC)
      eff('food', foodGain, `${u.name}が探索から食料を持ち帰った`, SRC)
    } else if (roll < greatChance + successChance + dangerChance) {
      const [dr, rc] = nextRandom(rng)
      rng = rc
      if (dr < E.deathShare) {
        units = units.filter((x) => x.id !== u.id)
        flags.casualties += 1
        eff('flag:casualties', 1, `${u.name}が探索で命を落とした`, SRC)
        addMorale(B.morale.hunger, '仲間を探索で失った')
        continue
      }
      u.condition = 'injured'
      eff(`unit:${u.id}`, 0, `${u.name}が探索から帰還した`, SRC)
      eff('flag:injury', 0, `${u.name}が探索で負傷した（効果半減）`, SRC)
    } else {
      eff(`unit:${u.id}`, 0, `${u.name}が探索から帰還した`, SRC)
      eff('food', 0, `${u.name}が探索したが収穫なく戻った`, SRC)
    }
    u.expedition = undefined
  }

  const powerDecay = Math.round(B.power.decay * queryMult(prev.modifiers, 'decay:power'))
  power = clamp(power - powerDecay, 0, 100)
  eff('power', -powerDecay, '発電設備が劣化した')
  const extra = power < B.medical.lowPowerAt ? B.medical.extraDecay : 0
  const medDecay = Math.round(
    (B.medical.decay + extra) * queryMult(prev.modifiers, 'decay:medical'),
  )
  medical = clamp(medical - medDecay, 0, 100)
  eff('medical', -medDecay, extra > 0 ? '停電で医療の効率が落ちた' : '医療資源が消費された')

  if (medical >= B.unit.healMedicalAt) {
    for (const u of units) {
      if (isAway(u)) continue
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
      let chance = B.unit.injuryChance * queryMult(prev.modifiers, 'chance:injury')
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

  addMorale(-B.morale.decay, '孤立生活のストレスが蓄積した')
  if (input.ration) addMorale(B.morale.ration, '配給を絞ったため、不満が高まった')
  if (food < presentCount * B.unit.foodPerUnit * B.morale.lowFoodDays)
    addMorale(B.morale.lowFood, '食料の残りが少なく、不安が広がった')
  if (medical < B.medical.neglectAt) addMorale(B.morale.lowMedical, '医療体制への不安が広がった')
  if (power < 30) addMorale(B.morale.lowPower, '暗闇への不満が広がった')
  if (
    food >= presentCount * B.unit.foodPerUnit * B.morale.lowFoodDays &&
    medical >= B.morale.calmMedicalAt &&
    power >= B.morale.calmPowerAt
  )
    addMorale(B.morale.calm, '穏やかな一日だった')

  if (morale >= B.morale.coopAt) {
    flags.cooperation += 1
    eff('flag:cooperation', 1, '住民同士の協力が深まった')
  }

  const presentForDesert = units.filter((u) => !isAway(u))
  if (morale < B.unit.desertionMoraleBelow && presentForDesert.length > 0) {
    const [lv, r3] = nextRandom(rng)
    rng = r3
    if (lv < B.unit.desertionChance * queryMult(prev.modifiers, 'chance:desertion')) {
      const [di, r4] = nextRandom(rng)
      rng = r4
      const idx = Math.floor(di * presentForDesert.length)
      const left = presentForDesert[idx]
      units = units.filter((u) => u.id !== left?.id)
      eff('flag:desert', 0, `${left?.name ?? '仲間'}が町を去った`)
      addMorale(B.morale.desertionRecover, '残った者たちで気持ちを引き締めた')
    }
  }

  if (morale < B.morale.riotAt) {
    const loss = Math.min(budget, B.morale.riotBudgetLoss)
    budget -= loss
    if (loss > 0) eff('budget', -loss, '住民の不満が爆発し、作業が滞った')
  }

  const drainStockpile = queryAdd(prev.modifiers, 'drain:stockpile')
  if (drainStockpile !== 0) {
    const before = stockpile
    stockpile = Math.max(0, stockpile + drainStockpile)
    const actual = stockpile - before
    if (actual !== 0) eff('stockpile', actual, '害虫により備蓄が損なわれた')
  }
  const drainFood = queryAdd(prev.modifiers, 'drain:food')
  if (drainFood !== 0) {
    const before = food
    food = Math.max(0, food + drainFood)
    const actual = food - before
    if (actual !== 0) eff('food', actual, '害虫により食料が損なわれた')
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
