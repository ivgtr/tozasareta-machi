import type { Effect, EffectTarget, EventDef, GameState, Unit } from '../types'
import { BALANCE } from './balance'
import { cloneUnit, makeRandomUnit, UNIQUE_UNITS } from './units'
import { nextRandom, weightedPick } from '../rng'

function baseFx(
  state: GameState,
  id: string,
  target: EffectTarget,
  delta: number,
  reason: string,
): Effect {
  return { day: state.day, source: `event:${id}`, target, delta, reason }
}

function resolveExpedition(
  state: GameState,
  unitId: string,
): { state: GameState; effects: Effect[] } {
  const E = BALANCE.expedition
  const idx = state.units.findIndex((u) => u.id === unitId)
  if (idx < 0) return { state, effects: [] }
  const unit = state.units[idx]
  if (!unit) return { state, effects: [] }
  const effects: Effect[] = []
  let rng = state.rng

  const aptMax = Math.max(unit.apt.labor, unit.apt.tech, unit.apt.medical, unit.apt.charm)
  const skill = aptMax / 10

  const [dv, r1] = nextRandom(rng)
  rng = r1
  const [iv, r2] = nextRandom(rng)
  rng = r2

  let units = state.units
  if (dv < E.deathBase * (1.3 - skill)) {
    units = units.filter((_, i) => i !== idx)
    effects.push(baseFx(state, 'expedition', 'flag:casualties', 1, `${unit.name}が探索で命を落とした`))
    effects.push(baseFx(state, 'expedition', 'morale', BALANCE.morale.hunger, '仲間を探索で失った'))
    return { state: { ...state, units, rng }, effects }
  }
  if (iv < E.injuryBase * (1.3 - skill)) {
    units = units.map((u, i) => (i === idx ? { ...u, condition: 'injured' as const } : u))
    effects.push(baseFx(state, 'expedition', `unit:${unit.id}`, 0, `${unit.name}が探索で負傷した`))
  }

  const [rv, r3] = nextRandom(rng)
  rng = r3
  const gain = 0.5 + skill * 0.7
  effects.push(
    baseFx(
      state,
      'expedition',
      'food',
      Math.round(E.food * gain * (0.6 + rv * 0.8)),
      `${unit.name}が食料を持ち帰った`,
    ),
  )
  if (rv > 0.6)
    effects.push(
      baseFx(state, 'expedition', 'stockpile', Math.round(E.stockpile * gain), `${unit.name}が備蓄を持ち帰った`),
    )
  if (rv > 0.8)
    effects.push(
      baseFx(state, 'expedition', 'budget', Math.round(E.budget * gain), `${unit.name}が物資を売り予算を得た`),
    )

  return { state: { ...state, units, rng }, effects }
}

export const EVENTS: EventDef[] = [
  {
    id: 'elderly_illness',
    name: '高齢者の体調不良',
    when: (c) => c.day >= 3,
    weight: (c) => 0.5 + (c.state.resources.medical < 50 ? 0.5 : 0),
    apply: (c) => [
      baseFx(c.state, 'elderly_illness', 'medical', -5, '高齢者の体調不良で医療が消費された'),
      baseFx(c.state, 'elderly_illness', 'morale', -3, '高齢者の体調不良に不安が広がった'),
    ],
  },
  {
    id: 'generator_failure',
    name: '発電機の故障',
    when: (c) => c.state.resources.power > 20,
    weight: (c) => 0.4 + (c.state.resources.power > 70 ? 0.2 : 0),
    apply: (c) => [
      baseFx(c.state, 'generator_failure', 'power', -32, '発電機が故障し、電力が大きく落ちた'),
    ],
  },
  {
    id: 'arrival',
    name: '人の到着',
    when: (c) => c.day >= 4 && c.state.units.length < BALANCE.unit.cap,
    weight: (c) => BALANCE.unit.arrivalBase + c.day * BALANCE.unit.arrivalPerDay,
    mutate: (state) => {
      const joined = state.flags.joinedUniques
      const available = UNIQUE_UNITS.filter((u) => !joined.includes(u.id))
      type Cand = { kind: 'unique'; unit: Unit } | { kind: 'random' }
      const cands: Cand[] = [
        ...available.map((u) => ({ kind: 'unique' as const, unit: u })),
        { kind: 'random' as const },
      ]
      const picked = weightedPick(
        cands,
        (c) =>
          c.kind === 'unique'
            ? BALANCE.unit.arrivalUniqueWeight
            : Math.max(available.length * BALANCE.unit.arrivalRandomCoef, 1),
        state.rng,
      )
      if (!picked) return { state, effects: [] }
      const [cand, rng] = picked
      if (cand.kind === 'unique') {
        const unit = cloneUnit(cand.unit)
        return {
          state: {
            ...state,
            units: [...state.units, unit],
            rng,
            flags: {
              ...state.flags,
              joinedUniques: [...joined, unit.id],
              refugeesAccepted: state.flags.refugeesAccepted + 1,
            },
          },
          effects: [
            baseFx(state, 'arrival', `unit:${unit.id}`, 0, `${unit.name}が町に辿り着いた`),
            baseFx(state, 'arrival', 'morale', 2, '新たな仲間に希望が湧いた'),
          ],
        }
      }
      const { unit, rng: r2 } = makeRandomUnit(
        rng,
        state.units.map((u) => u.name),
        state.units.map((u) => u.portrait),
      )
      return {
        state: {
          ...state,
          units: [...state.units, unit],
          rng: r2,
          flags: { ...state.flags, refugeesAccepted: state.flags.refugeesAccepted + 1 },
        },
        effects: [
          baseFx(state, 'arrival', `unit:${unit.id}`, 0, `${unit.name}が町に辿り着いた`),
          baseFx(state, 'arrival', 'morale', 2, '新たな仲間に希望が湧いた'),
        ],
      }
    },
  },
  {
    id: 'hidden_stockpile',
    name: '隠し備蓄の発見',
    once: true,
    when: (c) => c.day >= 4,
    weight: () => 0.3,
    apply: (c) => [
      baseFx(c.state, 'hidden_stockpile', 'stockpile', 30, '商店が隠していた備蓄が見つかった'),
      baseFx(c.state, 'hidden_stockpile', 'morale', 3, '思わぬ備蓄に安堵が広がった'),
    ],
  },
  {
    id: 'foraging',
    name: '食料の調達',
    when: (c) => c.day >= 5 && c.state.resources.food < 80,
    weight: () => 0.45,
    apply: (c) => [
      baseFx(c.state, 'foraging', 'food', 26, '周辺の山で食料を調達した'),
      baseFx(c.state, 'foraging', 'morale', 2, '食料のめどが立ち安堵が広がった'),
    ],
  },
  {
    id: 'power_restored',
    name: '仮設発電の復旧',
    when: (c) => c.day >= 5 && c.state.resources.power < 70,
    weight: () => 0.45,
    apply: (c) => [
      baseFx(c.state, 'power_restored', 'power', 26, '仮設発電が一時的に復旧した'),
      baseFx(c.state, 'power_restored', 'morale', 2, '灯りが戻り希望が湧いた'),
    ],
  },
  {
    id: 'medical_donation',
    name: '医薬品の寄贈',
    when: (c) => c.day >= 5 && c.state.resources.medical < 70,
    weight: () => 0.45,
    apply: (c) => [
      baseFx(c.state, 'medical_donation', 'medical', 26, '近隣から医薬品が寄せられた'),
      baseFx(c.state, 'medical_donation', 'morale', 2, '医療のめどが立ち安堵が広がった'),
    ],
  },
  {
    id: 'road_collapse',
    name: '道路の再崩落',
    when: (c) => c.day >= 6,
    weight: () => 0.4,
    apply: (c) => [
      baseFx(c.state, 'road_collapse', 'food', -28, '豪雨で復旧中の道路が再び崩れた'),
      baseFx(c.state, 'road_collapse', 'morale', -3, '復旧作業のやり直しに落胆が広がった'),
    ],
  },
  {
    id: 'volunteers',
    name: '住民の自主協力',
    when: (c) => c.state.resources.morale >= 50,
    weight: (c) => 0.4 + c.flags.cooperation * 0.05,
    apply: (c) => [
      baseFx(c.state, 'volunteers', 'morale', 5, '住民が自主的に作業を手伝い始めた'),
      baseFx(c.state, 'volunteers', 'flag:cooperation', 1, '自主的な協力の輪が広がった'),
    ],
  },
  {
    id: 'ration_protest',
    name: '配分への反発',
    when: (c) => c.flags.daysFoodCut >= 2,
    weight: (c) => 0.5 + c.flags.daysFoodCut * 0.3,
    apply: (c) => [
      baseFx(c.state, 'ration_protest', 'morale', -8, '一部の住民が物資配分に反発した'),
    ],
  },
  {
    id: 'rescue_contact',
    name: '救援隊からの連絡',
    once: true,
    when: (c) => c.day >= 18 && c.day <= 26,
    weight: () => 1,
    apply: (c) => [
      baseFx(c.state, 'rescue_contact', 'morale', 15, '救援隊から「あと5日で到着」と連絡が来た'),
    ],
  },
  {
    id: 'infection',
    name: '感染症の発生',
    when: (c) => c.state.resources.medical < 30,
    weight: (c) => ((30 - c.state.resources.medical) / 30) * 2 + c.flags.daysWithoutMedical * 0.5,
    apply: (c) => [
      baseFx(c.state, 'infection', 'medical', -22, '医療を放置したため感染症が広がった'),
      baseFx(c.state, 'infection', 'morale', -10, '感染症への不安で士気が下がった'),
    ],
  },
  {
    id: 'protest',
    name: '抗議の集まり',
    when: (c) => c.state.resources.morale < 35,
    weight: (c) => ((35 - c.state.resources.morale) / 35) * 1.5,
    apply: (c) => [
      baseFx(c.state, 'protest', 'budget', -10, '抗議への対応で予算を使った'),
      baseFx(c.state, 'protest', 'morale', -5, '抗議集会が開かれた'),
    ],
  },
  {
    id: 'blackout',
    name: '大規模停電',
    when: (c) => c.state.resources.power < 40,
    weight: () => 0.4,
    apply: (c) => [
      baseFx(c.state, 'blackout', 'power', -15, '大規模な停電が起きた'),
      baseFx(c.state, 'blackout', 'morale', -4, '停電で不安が広がった'),
    ],
  },
  {
    id: 'water_shortage',
    name: '水の不足',
    when: (c) => c.day >= 8,
    weight: () => 0.3,
    apply: (c) => [
      baseFx(c.state, 'water_shortage', 'morale', -5, '水が不足し、生活が逼迫した'),
      baseFx(c.state, 'water_shortage', 'medical', -3, '水不足で衛生状態が悪化した'),
    ],
  },
  {
    id: 'theft',
    name: '窃盗事件',
    when: (c) => c.state.resources.morale < 45,
    weight: () => 0.3,
    apply: (c) => [
      baseFx(c.state, 'theft', 'stockpile', -10, '備蓄の一部が盗まれた'),
      baseFx(c.state, 'theft', 'morale', -3, '窃盗事件に不信が広がった'),
    ],
  },
  {
    id: 'radio_repair',
    name: '無線機の修復',
    once: true,
    when: (c) => c.day >= 10,
    weight: () => 0.25,
    apply: (c) => [
      baseFx(c.state, 'radio_repair', 'morale', 6, '無線機が修復され、外部と連絡が取れた'),
    ],
  },
  {
    id: 'childbirth',
    name: '新しい命',
    once: true,
    when: (c) => c.day >= 7,
    weight: () => 0.2,
    apply: (c) => [
      baseFx(c.state, 'childbirth', 'morale', 8, '町で新しい命が生まれた'),
      baseFx(c.state, 'childbirth', 'flag:cooperation', 1, '命をめぐり住民が協力した'),
    ],
  },
  {
    id: 'elder_death',
    name: '高齢者の死去',
    when: (c) => c.state.resources.medical < 40,
    weight: (c) => 0.3 + c.flags.daysWithoutMedical * 0.2,
    apply: (c) => [
      baseFx(c.state, 'elder_death', 'morale', -8, '高齢者が亡くなり、町に喪の空気が漂った'),
    ],
  },
  {
    id: 'trader',
    name: '行商人の来訪',
    when: (c) => c.day >= 6,
    weight: () => 0.3,
    apply: (c) => [
      baseFx(c.state, 'trader', 'budget', 25, '行商人との取引で予算を得た'),
      baseFx(c.state, 'trader', 'morale', 2, '行商人が外の知らせを伝えてくれた'),
    ],
  },
  {
    id: 'wildlife',
    name: '野生動物の出没',
    when: (c) => c.day >= 9,
    weight: () => 0.2,
    apply: (c) => [
      baseFx(c.state, 'wildlife', 'food', -10, '野生動物が食料を荒らした'),
      baseFx(c.state, 'wildlife', 'morale', -2, '野生動物の出没に不安が広がった'),
    ],
  },
  {
    id: 'clear_weather',
    name: '天候の回復',
    when: (c) => c.day >= 5,
    weight: () => 0.35,
    apply: (c) => [baseFx(c.state, 'clear_weather', 'morale', 5, '天候が回復し、空が晴れ渡った')],
  },
  {
    id: 'landslide_warning',
    name: '土砂災害警戒',
    when: (c) => c.day >= 12,
    weight: () => 0.3,
    apply: (c) => [baseFx(c.state, 'landslide_warning', 'morale', -4, '土砂災害警戒が発令された')],
  },
  {
    id: 'trade_offer',
    name: '交易の申し出',
    kind: 'choice',
    when: (c) => c.day >= 6,
    weight: () => 0.4,
    choices: [
      {
        id: 'buy_food',
        label: '食料を買う',
        desc: '予算15 → 食料+20',
        when: (c) => c.state.budget >= 15,
        apply: (c) => [
          baseFx(c.state, 'trade_offer', 'budget', -15, '食料の代金を払った'),
          baseFx(c.state, 'trade_offer', 'food', 20, '食料を買い入れた'),
        ],
      },
      {
        id: 'buy_medical',
        label: '医薬品を買う',
        desc: '予算15 → 医療+20',
        when: (c) => c.state.budget >= 15,
        apply: (c) => [
          baseFx(c.state, 'trade_offer', 'budget', -15, '医薬品の代金を払った'),
          baseFx(c.state, 'trade_offer', 'medical', 20, '医薬品を買い入れた'),
        ],
      },
      {
        id: 'sell_stockpile',
        label: '備蓄を売る',
        desc: '備蓄10 → 予算+20',
        when: (c) => c.state.stockpile >= 10,
        apply: (c) => [
          baseFx(c.state, 'trade_offer', 'stockpile', -10, '備蓄を売却した'),
          baseFx(c.state, 'trade_offer', 'budget', 20, '備蓄を売って予算を得た'),
        ],
      },
      { id: 'decline', label: '断る', apply: () => [] },
    ],
  },
  {
    id: 'power_crisis',
    name: '電力の逼迫',
    kind: 'choice',
    when: (c) => c.state.resources.power < 40,
    weight: () => 0.4,
    choices: [
      {
        id: 'divert_medical',
        label: '医療の電力を回す',
        desc: '医療-15 / 電力+20',
        apply: (c) => [
          baseFx(c.state, 'power_crisis', 'medical', -15, '医療の電力を発電に回した'),
          baseFx(c.state, 'power_crisis', 'power', 20, '電力を確保した'),
        ],
      },
      {
        id: 'endure_dark',
        label: '暗闇に耐える',
        desc: '士気-8',
        apply: (c) => [baseFx(c.state, 'power_crisis', 'morale', -8, '暗闇に不満が募った')],
      },
    ],
  },
  {
    id: 'stockpile_crisis',
    name: '備蓄の扱い',
    kind: 'choice',
    when: (c) => c.day >= 8 && c.state.stockpile >= 15,
    weight: () => 0.35,
    choices: [
      {
        id: 'distribute',
        label: '備蓄を配る',
        desc: '備蓄-15 / 士気+12',
        apply: (c) => [
          baseFx(c.state, 'stockpile_crisis', 'stockpile', -15, '備蓄を住民に配った'),
          baseFx(c.state, 'stockpile_crisis', 'morale', 12, '備蓄の配給で士気が上がった'),
        ],
      },
      {
        id: 'reserve',
        label: '温存する',
        desc: '士気-5',
        apply: (c) => [baseFx(c.state, 'stockpile_crisis', 'morale', -5, '備蓄を温存し、不満が出た')],
      },
    ],
  },
  {
    id: 'expedition',
    name: '探索の機会',
    desc: '誰かを選んで探索に出す。負傷や死亡の危険がある。',
    kind: 'choice',
    when: (c) => c.day >= BALANCE.expedition.dayFrom && c.state.units.length > 0,
    weight: () => BALANCE.expedition.weight,
    perUnit: (u) => {
      const aptMax = Math.max(u.apt.labor, u.apt.tech, u.apt.medical, u.apt.charm)
      return {
        id: `send_${u.id}`,
        label: `${u.name}を行かせる`,
        desc: `最大適性 ${aptMax}`,
        mutate: (state) => resolveExpedition(state, u.id),
      }
    },
    choices: [{ id: 'skip', label: '見送る', apply: () => [] }],
  },
]
