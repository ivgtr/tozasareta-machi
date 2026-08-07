import type {
  Effect,
  EffectTarget,
  Flags,
  GameState,
  RngState,
  TaskId,
  Unit,
} from './types'
import { BALANCE } from './data/balance'
import { APTITUDE_LABEL } from './data/units'
import { TASK_APT, isOnExpedition } from './actions'
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

interface SettlementContext {
  readonly prev: GameState
  readonly input: SettleInput
  readonly day: number
  effects: Effect[]
  food: number
  power: number
  medical: number
  morale: number
  budget: number
  stockpile: number
  units: Unit[]
  flags: Flags
  rng: RngState
}

export function lowFoodThreshold(present: number): number {
  return present * BALANCE.unit.foodPerUnit * BALANCE.morale.lowFoodDays
}

function createContext(prev: GameState, input: SettleInput): SettlementContext {
  return {
    prev,
    input,
    day: prev.day,
    effects: [],
    food: prev.resources.food,
    power: prev.resources.power,
    medical: prev.resources.medical,
    morale: prev.resources.morale,
    budget: prev.budget,
    stockpile: prev.stockpile,
    units: prev.units.map((unit) => ({
      ...unit,
      apt: { ...unit.apt },
      traits: [...unit.traits],
    })),
    flags: {
      ...prev.flags,
      fired: [...prev.flags.fired],
      joinedUniques: [...prev.flags.joinedUniques],
    },
    rng: prev.rng,
  }
}

function addEffect(
  context: SettlementContext,
  target: EffectTarget,
  delta: number,
  reason: string,
  source = 'settlement',
): void {
  context.effects.push({ day: context.day, source, target, delta, reason })
}

function addMorale(context: SettlementContext, delta: number, reason: string): void {
  const before = context.morale
  context.morale = clamp(context.morale + delta, 0, 100)
  const actual = context.morale - before
  if (actual !== 0) addEffect(context, 'morale', actual, reason)
}

function presentUnits(context: SettlementContext): Unit[] {
  return context.units.filter((unit) => !isOnExpedition(unit))
}

function settleIncomeAndProcurement(context: SettlementContext): void {
  const bonus = context.power >= BALANCE.budget.bonusAt ? BALANCE.budget.bonus : 0
  const incomeMult = queryMult(context.prev.modifiers, 'income:budget')
  const income = Math.round((BALANCE.budget.income + bonus) * incomeMult)
  context.budget += income
  addEffect(
    context,
    'budget',
    income,
    bonus > 0 ? '電力が安定し、商業から予算を得た' : '町の活動から予算を得た',
  )

  if (context.input.procure && context.budget >= BALANCE.procure.budget) {
    context.budget -= BALANCE.procure.budget
    context.stockpile += BALANCE.procure.stockpile
    addEffect(context, 'budget', -BALANCE.procure.budget, '備蓄の調達に予算を使った')
    addEffect(context, 'stockpile', BALANCE.procure.stockpile, '備蓄を調達した')
  }
}

function settleTraitMorale(context: SettlementContext): void {
  for (const unit of context.units) {
    if (isOnExpedition(unit)) continue
    if (unit.traits.includes('popular')) {
      addMorale(context, BALANCE.trait.popularMorale, `${unit.name}の存在が人心を和ませた`)
    }
    if (unit.traits.includes('troublemaker')) {
      addMorale(
        context,
        BALANCE.trait.troublemakerMorale,
        `${unit.name}が揉め事を起こした`,
      )
    }
  }
}

function settleFood(context: SettlementContext): void {
  const consumeMult = queryMult(context.prev.modifiers, 'consume:food')
  const consume = Math.round(
    presentUnits(context).length *
      BALANCE.unit.foodPerUnit *
      (context.input.ration ? 0.5 : 1) *
      consumeMult,
  )
  context.food -= consume
  addEffect(
    context,
    'food',
    -consume,
    context.input.ration ? '配給を絞り、消費を抑えた' : '人々が食料を消費した',
  )

  const foodDecay = Math.round(
    BALANCE.food.decay * queryMult(context.prev.modifiers, 'decay:food'),
  )
  context.food -= foodDecay
  addEffect(context, 'food', -foodDecay, '食料が劣化した')

  if (context.food < 0 && context.stockpile > 0) {
    const take = Math.min(context.stockpile, -context.food)
    context.stockpile -= take
    context.food += take
    addEffect(context, 'stockpile', -take, '備蓄を取り崩して飢えをしのいだ')
  }

  if (context.food >= 0) return
  context.food = 0
  const present = presentUnits(context)
  if (present.length === 0) {
    addMorale(context, BALANCE.morale.hunger, '食料が尽きた')
    return
  }

  const [deathRoll, nextRng] = nextRandom(context.rng)
  context.rng = nextRng
  const dead = present[Math.floor(deathRoll * present.length)]
  context.units = context.units.filter((unit) => unit.id !== dead?.id)
  context.flags.casualties += 1
  addEffect(
    context,
    'flag:casualties',
    1,
    `食料が尽き、${dead?.name ?? '仲間'}が亡くなった`,
  )
  addMorale(context, BALANCE.morale.hunger, '仲間を飢えで失った')
}

function settleExpeditions(context: SettlementContext): void {
  const expedition = BALANCE.expedition
  for (const unit of [...context.units]) {
    const awaySince = unit.expedition
    if (awaySince === undefined) continue

    const daysAway = context.day - awaySince
    if (daysAway < expedition.minDays) continue

    const [returnRoll, returnRng] = nextRandom(context.rng)
    context.rng = returnRng
    const returnChance = Math.min(
      expedition.returnBase + (daysAway - expedition.minDays) * expedition.returnPerDay,
      expedition.returnCap,
    )
    if (returnRoll >= returnChance) continue

    const aptitude = Math.max(
      unit.apt.labor,
      unit.apt.tech,
      unit.apt.medical,
      unit.apt.charm,
    )
    const aptitudeRate = Math.max(0, Math.min(1, (aptitude / 10 - 0.2) / 0.8))
    const greatChance =
      expedition.greatAtMin + aptitudeRate * (expedition.greatAtMax - expedition.greatAtMin)
    const successChance =
      expedition.successAtMin +
      aptitudeRate * (expedition.successAtMax - expedition.successAtMin)
    const dangerChance =
      expedition.dangerAtMin + aptitudeRate * (expedition.dangerAtMax - expedition.dangerAtMin)

    const [outcomeRoll, outcomeRng] = nextRandom(context.rng)
    context.rng = outcomeRng
    const dailyYield = aptitude * expedition.rewardCoef
    const daysMultiplier =
      1 + Math.max(0, daysAway - expedition.minDays) * expedition.returnBonusPerDay

    if (outcomeRoll < greatChance) {
      settleGreatExpedition(context, unit, dailyYield, daysMultiplier)
    } else if (outcomeRoll < greatChance + successChance) {
      settleSuccessfulExpedition(context, unit, dailyYield, daysMultiplier)
    } else if (outcomeRoll < greatChance + successChance + dangerChance) {
      if (settleDangerousExpedition(context, unit)) continue
    } else {
      addEffect(
        context,
        `unit:${unit.id}`,
        0,
        `${unit.name}が探索から帰還した`,
        EXPEDITION_RETURN_SOURCE,
      )
      addEffect(
        context,
        'food',
        0,
        `${unit.name}が探索したが収穫なく戻った`,
        EXPEDITION_RETURN_SOURCE,
      )
    }
    unit.expedition = undefined
  }
}

function expeditionVariance(context: SettlementContext): number {
  const [roll, rng] = nextRandom(context.rng)
  context.rng = rng
  return 0.7 + roll * 0.6
}

function settleGreatExpedition(
  context: SettlementContext,
  unit: Unit,
  dailyYield: number,
  daysMultiplier: number,
): void {
  const variance = expeditionVariance(context)
  const foodGain = Math.round(
    dailyYield * BALANCE.expedition.greatDays * daysMultiplier * variance,
  )
  const stockGain = Math.round(dailyYield * 2 * daysMultiplier * variance)
  const budgetGain = Math.round(dailyYield * 1.5 * daysMultiplier * variance)
  context.food += foodGain
  context.stockpile += stockGain
  context.budget += budgetGain
  addEffect(
    context,
    `unit:${unit.id}`,
    0,
    `${unit.name}が探索から帰還した`,
    EXPEDITION_RETURN_SOURCE,
  )
  addEffect(
    context,
    'food',
    foodGain,
    `${unit.name}が探索で大成功——食料を持ち帰った`,
    EXPEDITION_RETURN_SOURCE,
  )
  addEffect(
    context,
    'stockpile',
    stockGain,
    `${unit.name}が備蓄を持ち帰った`,
    EXPEDITION_RETURN_SOURCE,
  )
  addEffect(
    context,
    'budget',
    budgetGain,
    `${unit.name}が物資を売り予算を得た`,
    EXPEDITION_RETURN_SOURCE,
  )
}

function settleSuccessfulExpedition(
  context: SettlementContext,
  unit: Unit,
  dailyYield: number,
  daysMultiplier: number,
): void {
  const variance = expeditionVariance(context)
  const foodGain = Math.round(dailyYield * daysMultiplier * variance)
  context.food += foodGain
  addEffect(
    context,
    `unit:${unit.id}`,
    0,
    `${unit.name}が探索から帰還した`,
    EXPEDITION_RETURN_SOURCE,
  )
  addEffect(
    context,
    'food',
    foodGain,
    `${unit.name}が探索から食料を持ち帰った`,
    EXPEDITION_RETURN_SOURCE,
  )
}

function settleDangerousExpedition(context: SettlementContext, unit: Unit): boolean {
  const [dangerRoll, rng] = nextRandom(context.rng)
  context.rng = rng
  if (dangerRoll < BALANCE.expedition.deathShare) {
    context.units = context.units.filter((candidate) => candidate.id !== unit.id)
    context.flags.casualties += 1
    addEffect(
      context,
      'flag:casualties',
      1,
      `${unit.name}が探索で命を落とした`,
      EXPEDITION_RETURN_SOURCE,
    )
    addMorale(context, BALANCE.morale.hunger, '仲間を探索で失った')
    return true
  }

  unit.condition = 'injured'
  addEffect(
    context,
    `unit:${unit.id}`,
    0,
    `${unit.name}が探索から帰還した`,
    EXPEDITION_RETURN_SOURCE,
  )
  addEffect(
    context,
    'flag:injury',
    0,
    `${unit.name}が探索で負傷した（効果半減）`,
    EXPEDITION_RETURN_SOURCE,
  )
  return false
}

function settleInfrastructure(context: SettlementContext): void {
  const powerDecay = Math.round(
    BALANCE.power.decay * queryMult(context.prev.modifiers, 'decay:power'),
  )
  context.power = clamp(context.power - powerDecay, 0, 100)
  addEffect(context, 'power', -powerDecay, '発電設備が劣化した')

  const extra = context.power < BALANCE.power.lowAt ? BALANCE.medical.extraDecay : 0
  const medicalDecay = Math.round(
    (BALANCE.medical.decay + extra) *
      queryMult(context.prev.modifiers, 'decay:medical'),
  )
  context.medical = clamp(context.medical - medicalDecay, 0, 100)
  addEffect(
    context,
    'medical',
    -medicalDecay,
    extra > 0 ? '停電で医療の効率が落ちた' : '医療資源が消費された',
  )
}

function settleHealth(context: SettlementContext): void {
  if (context.medical >= BALANCE.unit.healMedicalAt) {
    for (const unit of context.units) {
      if (isOnExpedition(unit) || unit.condition !== 'injured') continue
      unit.condition = 'healthy'
      addEffect(context, 'flag:heal', 0, `${unit.name}の怪我が治った`)
    }
  }

  if (context.medical >= BALANCE.unit.injuryMedicalBelow) return
  const workedHealthy = context.input.worked
    .map((work) => context.units.find((unit) => unit.id === work.unitId))
    .filter(
      (unit): unit is Unit => unit !== undefined && unit.condition === 'healthy',
    )

  for (const unit of workedHealthy) {
    if (unit.traits.includes('sturdy')) continue
    let chance =
      BALANCE.unit.injuryChance * queryMult(context.prev.modifiers, 'chance:injury')
    if (unit.traits.includes('clumsy')) chance *= 2
    const [injuryRoll, rng] = nextRandom(context.rng)
    context.rng = rng
    if (injuryRoll < chance) {
      unit.condition = 'injured'
      addEffect(context, 'flag:injury', 0, `${unit.name}が怪我を負った（効果半減）`)
    }
  }
}

function settleGrowth(context: SettlementContext): void {
  for (const work of context.input.worked) {
    const unit = context.units.find((candidate) => candidate.id === work.unitId)
    if (!unit) continue
    unit.xp += 1
    if (unit.xp < BALANCE.unit.growthThreshold) continue

    unit.xp -= BALANCE.unit.growthThreshold
    const aptitude = TASK_APT[work.task]
    if (aptitude && unit.apt[aptitude] < 10) {
      unit.apt[aptitude] += 1
      addEffect(
        context,
        'flag:growth',
        0,
        `${unit.name}が成長した（${APTITUDE_LABEL[aptitude]}+1）`,
      )
    }
  }
}

function updateDailyFlags(context: SettlementContext): void {
  context.flags.daysWithoutMedical =
    context.medical < BALANCE.medical.neglectAt
      ? context.flags.daysWithoutMedical + 1
      : 0
  context.flags.daysFoodCut = context.input.ration
    ? context.flags.daysFoodCut + 1
    : 0
}

function settleDailyMorale(context: SettlementContext): void {
  addMorale(context, -BALANCE.morale.decay, '孤立生活のストレスが蓄積した')
  if (context.input.ration) {
    addMorale(context, BALANCE.morale.ration, '配給を絞ったため、不満が高まった')
  }

  const present = presentUnits(context)
  if (context.food < lowFoodThreshold(present.length)) {
    addMorale(context, BALANCE.morale.lowFood, '食料の残りが少なく、不安が広がった')
  }
  if (context.medical < BALANCE.medical.neglectAt) {
    addMorale(context, BALANCE.morale.lowMedical, '医療体制への不安が広がった')
  }
  if (context.power < BALANCE.power.lowAt) {
    addMorale(context, BALANCE.morale.lowPower, '暗闇への不満が広がった')
  }
  if (
    context.food >= lowFoodThreshold(present.length) &&
    context.medical >= BALANCE.morale.calmMedicalAt &&
    context.power >= BALANCE.morale.calmPowerAt
  ) {
    addMorale(context, BALANCE.morale.calm, '穏やかな一日だった')
  }

  if (context.morale >= BALANCE.morale.coopAt) {
    context.flags.cooperation += 1
    addEffect(context, 'flag:cooperation', 1, '住民同士の協力が深まった')
  }

  settleDesertion(context)
  settleRiot(context)
}

function settleDesertion(context: SettlementContext): void {
  const present = presentUnits(context)
  if (context.morale >= BALANCE.unit.desertionMoraleBelow || present.length === 0) return

  const [desertionRoll, firstRng] = nextRandom(context.rng)
  context.rng = firstRng
  const chance =
    BALANCE.unit.desertionChance *
    queryMult(context.prev.modifiers, 'chance:desertion')
  if (desertionRoll >= chance) return

  const [unitRoll, secondRng] = nextRandom(context.rng)
  context.rng = secondRng
  const left = present[Math.floor(unitRoll * present.length)]
  context.units = context.units.filter((unit) => unit.id !== left?.id)
  addEffect(context, 'flag:desert', 0, `${left?.name ?? '仲間'}が町を去った`)
  addMorale(
    context,
    BALANCE.morale.desertionRecover,
    '残った者たちで気持ちを引き締めた',
  )
}

function settleRiot(context: SettlementContext): void {
  if (context.morale >= BALANCE.morale.riotAt) return
  const loss = Math.min(context.budget, BALANCE.morale.riotBudgetLoss)
  context.budget -= loss
  if (loss > 0) addEffect(context, 'budget', -loss, '住民の不満が爆発し、作業が滞った')
}

function settleModifierDrains(context: SettlementContext): void {
  const stockpileDrain = queryAdd(context.prev.modifiers, 'drain:stockpile')
  if (stockpileDrain !== 0) {
    const before = context.stockpile
    context.stockpile = Math.max(0, context.stockpile + stockpileDrain)
    const actual = context.stockpile - before
    if (actual !== 0) addEffect(context, 'stockpile', actual, '害虫により備蓄が損なわれた')
  }

  const foodDrain = queryAdd(context.prev.modifiers, 'drain:food')
  if (foodDrain !== 0) {
    const before = context.food
    context.food = Math.max(0, context.food + foodDrain)
    const actual = context.food - before
    if (actual !== 0) addEffect(context, 'food', actual, '害虫により食料が損なわれた')
  }
}

function toResult(context: SettlementContext): SettleResult {
  return {
    state: {
      ...context.prev,
      resources: {
        food: context.food,
        power: context.power,
        medical: context.medical,
        morale: context.morale,
      },
      budget: context.budget,
      stockpile: context.stockpile,
      units: context.units,
      flags: context.flags,
      rng: context.rng,
    },
    effects: context.effects,
  }
}

export function settle(prev: GameState, input: SettleInput): SettleResult {
  const context = createContext(prev, input)
  settleIncomeAndProcurement(context)
  settleTraitMorale(context)
  settleFood(context)
  settleExpeditions(context)
  settleInfrastructure(context)
  settleHealth(context)
  settleGrowth(context)
  updateDailyFlags(context)
  settleDailyMorale(context)
  settleModifierDrains(context)
  return toResult(context)
}
