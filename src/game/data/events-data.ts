import type { Effect, EffectTarget, EventDef, GameState, Unit } from '../types'
import { BALANCE } from './balance'
import { cloneUnit, makeRandomUnit, UNIQUE_UNITS } from './units'
import { weightedPick, nextRandom } from '../rng'
import { addModifier } from '../modifiers'

function baseFx(
  state: GameState,
  id: string,
  target: EffectTarget,
  delta: number,
  reason: string,
): Effect {
  return { day: state.day, source: `event:${id}`, target, delta, reason }
}

export const EVENTS: EventDef[] = [
  {
    id: 'elderly_illness',
    name: '高齢者の体調不良',
    tone: 'threat',
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
    tone: 'threat',
    when: (c) => c.state.resources.power > 50,
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
    tone: 'boon',
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
    tone: 'boon',
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
    tone: 'boon',
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
    tone: 'boon',
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
    tone: 'threat',
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
    tone: 'boon',
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
    tone: 'threat',
    when: (c) => c.flags.daysFoodCut >= 2,
    weight: (c) => 0.5 + c.flags.daysFoodCut * 0.3,
    apply: (c) => [
      baseFx(c.state, 'ration_protest', 'morale', -8, '一部の住民が物資配分に反発した'),
    ],
  },
  {
    id: 'rescue_contact',
    name: '救援隊からの連絡',
    tone: 'boon',
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
    tone: 'threat',
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
    tone: 'threat',
    when: (c) => c.state.resources.morale < 35,
    weight: (c) => ((35 - c.state.resources.morale) / 35) * 1.5,
    apply: (c) => [
      baseFx(c.state, 'protest', 'budget', -10, '抗議への対応で予算を使った'),
      baseFx(c.state, 'protest', 'morale', -5, '抗議集会が開かれた'),
    ],
  },

  {
    id: 'water_shortage',
    name: '水の不足',
    tone: 'threat',
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
    tone: 'threat',
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
    tone: 'boon',
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
    tone: 'boon',
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
    tone: 'threat',
    when: (c) => c.state.resources.medical < 40,
    weight: (c) => 0.3 + c.flags.daysWithoutMedical * 0.2,
    apply: (c) => [
      baseFx(c.state, 'elder_death', 'morale', -8, '高齢者が亡くなり、町に喪の空気が漂った'),
    ],
  },

  {
    id: 'wildlife',
    name: '野生動物の出没',
    tone: 'threat',
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
    tone: 'boon',
    when: (c) => c.day >= 5,
    weight: () => 0.35,
    apply: (c) => [baseFx(c.state, 'clear_weather', 'morale', 5, '天候が回復し、空が晴れ渡った')],
  },
  {
    id: 'landslide_warning',
    name: '土砂災害警戒',
    tone: 'threat',
    when: (c) => c.day >= 12,
    weight: () => 0.3,
    apply: (c) => [baseFx(c.state, 'landslide_warning', 'morale', -4, '土砂災害警戒が発令された')],
  },

  {
    id: 'manna',
    name: '恵みの雨',
    tone: 'boon',
    once: true,
    when: (c) => c.day >= 10,
    weight: () => 0.06,
    mutate: (state) => {
      const M = BALANCE.modifier.manna
      const modifiers = addModifier(state.modifiers, {
        id: 'manna',
        daysLeft: M.days,
        startDay: state.day,
        effects: [{ target: 'consume:food', op: 'set', value: 0 }],
      })
      return {
        state: { ...state, modifiers },
        effects: [
          baseFx(state, 'manna', 'morale', 5, '恵みの雨が降り、食料の心配がしばらく消えた'),
        ],
      }
    },
  },
  {
    id: 'supply_drop',
    name: '救援物資の投下',
    tone: 'boon',
    once: true,
    when: (c) => c.day >= 12,
    weight: () => 0.07,
    apply: (c) => [
      baseFx(c.state, 'supply_drop', 'food', 15, '救援物資が投下された——食料'),
      baseFx(c.state, 'supply_drop', 'power', 15, '救援物資が投下された——燃料'),
      baseFx(c.state, 'supply_drop', 'medical', 15, '救援物資が投下された——医薬品'),
      baseFx(c.state, 'supply_drop', 'stockpile', 15, '救援物資が投下された——備蓄'),
    ],
  },
  {
    id: 'hot_spring',
    name: '温泉の発見',
    tone: 'boon',
    once: true,
    when: (c) => c.day >= 8,
    weight: () => 0.05,
    apply: (c) => [
      baseFx(c.state, 'hot_spring', 'morale', 20, '温泉が見つかり、住民が癒やされた'),
      baseFx(c.state, 'hot_spring', 'medical', 10, '温泉の効能で体調が改善した'),
    ],
  },
  {
    id: 'miracle_harvest',
    name: '奇跡の収穫',
    tone: 'boon',
    once: true,
    when: (c) => c.day >= 10,
    weight: () => 0.06,
    apply: (c) => [
      baseFx(c.state, 'miracle_harvest', 'food', 40, '山畑が例年になく豊作だった'),
      baseFx(c.state, 'miracle_harvest', 'stockpile', 15, '余剰を備蓄に回した'),
    ],
  },

  {
    id: 'sunny_stretch',
    name: '晴天続き',
    tone: 'boon',
    when: (c) => c.day >= 5 && c.state.resources.power < 80,
    weight: () => 0.2,
    mutate: (state) => {
      const M = BALANCE.modifier.sunny_stretch
      const modifiers = addModifier(state.modifiers, {
        id: 'sunny_stretch',
        daysLeft: M.days,
        startDay: state.day,
        effects: [{ target: 'produce:repair_power', op: 'mult', value: M.mult }],
      })
      return {
        state: { ...state, modifiers },
        effects: [baseFx(state, 'sunny_stretch', 'morale', 2, '晴天が続き、発電がはかどる')],
      }
    },
  },
  {
    id: 'animal_trap',
    name: '獣の罠',
    tone: 'boon',
    when: (c) => c.day >= 5,
    weight: () => 0.2,
    apply: (c) => [
      baseFx(c.state, 'animal_trap', 'food', 20, '罠に獣がかかり、食料を得た'),
      baseFx(c.state, 'animal_trap', 'stockpile', 10, '毛皮や骨を備蓄に回した'),
    ],
  },
  {
    id: 'traveling_engineer',
    name: '旅の技術者',
    tone: 'boon',
    when: (c) => c.day >= 6,
    weight: () => 0.15,
    mutate: (state) => {
      const M = BALANCE.modifier.traveling_engineer
      const modifiers = addModifier(state.modifiers, {
        id: 'traveling_engineer',
        daysLeft: M.days,
        startDay: state.day,
        effects: [{ target: 'produce:reinforce_medical', op: 'mult', value: M.mult }],
      })
      return {
        state: { ...state, modifiers },
        effects: [
          baseFx(state, 'traveling_engineer', 'morale', 3, '旅の技術者が医療機器を整備してくれた'),
        ],
      }
    },
  },
  {
    id: 'volunteer_surge',
    name: 'ボランティア殺到',
    tone: 'boon',
    when: (c) => c.day >= 6 && c.state.resources.morale >= 40,
    weight: () => 0.15,
    mutate: (state) => {
      const M = BALANCE.modifier.volunteer_surge
      const modifiers = addModifier(state.modifiers, {
        id: 'volunteer_surge',
        daysLeft: M.days,
        startDay: state.day,
        effects: [{ target: 'produce:all', op: 'mult', value: M.mult }],
      })
      return {
        state: { ...state, modifiers },
        effects: [
          baseFx(state, 'volunteer_surge', 'morale', 2, 'ボランティアが殺到し、活気づいた'),
        ],
      }
    },
  },
  {
    id: 'clean_water',
    name: '湧水の発見',
    tone: 'boon',
    when: (c) => c.day >= 5 && c.state.resources.medical < 80,
    weight: () => 0.2,
    apply: (c) => [
      baseFx(c.state, 'clean_water', 'medical', 15, '綺麗な湧水が見つかり、衛生が改善した'),
      baseFx(c.state, 'clean_water', 'morale', 5, '安全な水に安堵が広がった'),
    ],
  },
  {
    id: 'cached_fuel',
    name: '燃料の備蓄発見',
    tone: 'boon',
    when: (c) => c.day >= 6 && c.state.resources.power < 80,
    weight: () => 0.2,
    apply: (c) => [
      baseFx(c.state, 'cached_fuel', 'power', 20, '倉庫から燃料の備蓄が見つかった'),
      baseFx(c.state, 'cached_fuel', 'stockpile', 10, '余剰燃料を備蓄に回した'),
    ],
  },

  {
    id: 'typhoon',
    name: '台風接近',
    tone: 'threat',
    when: (c) => c.day >= 8,
    weight: () => 0.3,
    mutate: (state) => {
      const M = BALANCE.modifier.typhoon
      const modifiers = addModifier(state.modifiers, {
        id: 'typhoon',
        daysLeft: M.days,
        startDay: state.day,
        effects: [
          { target: 'produce:repair_power', op: 'set', value: 0 },
          { target: 'produce:restore_road', op: 'set', value: 0 },
        ],
      })
      return {
        state: { ...state, modifiers },
        effects: [baseFx(state, 'typhoon', 'morale', -3, '台風が接近し、屋外作業が危険になった')],
      }
    },
  },
  {
    id: 'storage_flood',
    name: '備蓄庫の浸水',
    tone: 'threat',
    when: (c) => c.day >= 7 && c.state.stockpile >= 20,
    weight: () => 0.25,
    apply: (c) => [
      baseFx(c.state, 'storage_flood', 'stockpile', -20, '備蓄庫が浸水し、備蓄が損なわれた'),
      baseFx(c.state, 'storage_flood', 'food', -10, '浸水で食料の一部が駄目になった'),
    ],
  },
  {
    id: 'generator_overheat',
    name: '発電機の過熱',
    tone: 'threat',
    when: (c) => c.day >= 6 && c.state.resources.power > 30,
    weight: () => 0.25,
    mutate: (state) => {
      const M = BALANCE.modifier.generator_overheat
      const modifiers = addModifier(state.modifiers, {
        id: 'generator_overheat',
        daysLeft: M.lockDays,
        startDay: state.day,
        effects: [{ target: 'produce:repair_power', op: 'set', value: 0 }],
      })
      return {
        state: { ...state, modifiers },
        effects: [
          baseFx(state, 'generator_overheat', 'power', -20, '発電機が過熱し、電力が落ちた'),
        ],
      }
    },
  },
  {
    id: 'landslide_actual',
    name: '地滑り発生',
    tone: 'threat',
    when: (c) => c.day >= 10,
    weight: () => 0.25,
    mutate: (state) => {
      const present = state.units.filter((u) => u.expedition === undefined)
      let units = state.units
      let rng = state.rng
      const injuryFx: Effect[] = []
      if (present.length > 0) {
        const [roll, r1] = nextRandom(rng)
        rng = r1
        const idx = Math.floor(roll * present.length)
        const target = present[idx]
        if (target && target.condition === 'healthy' && !target.traits.includes('sturdy')) {
          units = units.map((u) =>
            u.id === target.id ? { ...u, condition: 'injured' as const } : u,
          )
          injuryFx.push(
            baseFx(state, 'landslide_actual', 'flag:injury', 0, `${target.name}が地滑りで負傷した`),
          )
        }
      }
      return {
        state: { ...state, units, rng },
        effects: [
          baseFx(state, 'landslide_actual', 'stockpile', -15, '地滑りで備蓄の一部が埋まった'),
          ...injuryFx,
        ],
      }
    },
  },
  {
    id: 'food_spoilage',
    name: '食料の腐敗',
    tone: 'threat',
    when: (c) => c.day >= 7 && c.state.resources.food >= 30,
    weight: () => 0.25,
    apply: (c) => [baseFx(c.state, 'food_spoilage', 'food', -25, '保存状態が悪く、食料が腐敗した')],
  },
  {
    id: 'cold_snap',
    name: '寒波',
    tone: 'threat',
    when: (c) => c.day >= 12,
    weight: () => 0.25,
    mutate: (state) => {
      const M = BALANCE.modifier.cold_snap
      const modifiers = addModifier(state.modifiers, {
        id: 'cold_snap',
        daysLeft: M.days,
        startDay: state.day,
        effects: [{ target: 'decay:power', op: 'mult', value: M.mult }],
      })
      return {
        state: { ...state, modifiers },
        effects: [baseFx(state, 'cold_snap', 'morale', -3, '寒波が襲来し、暖房の需要が増えた')],
      }
    },
  },
  {
    id: 'rumor',
    name: 'デマの拡散',
    tone: 'threat',
    when: (c) => c.day >= 6 && c.state.resources.morale >= 30,
    weight: () => 0.2,
    apply: (c) => [baseFx(c.state, 'rumor', 'morale', -12, '根拠のない噂が広まり、不安が爆発した')],
  },
  {
    id: 'rat_infestation',
    name: 'ネズミの大量発生',
    tone: 'threat',
    when: (c) => c.day >= 8 && c.state.stockpile >= 15,
    weight: () => 0.25,
    mutate: (state) => {
      const M = BALANCE.modifier.rat_infestation
      const modifiers = addModifier(state.modifiers, {
        id: 'rat_infestation',
        daysLeft: M.days,
        startDay: state.day,
        effects: [{ target: 'drain:stockpile', op: 'add', value: M.drain }],
      })
      return {
        state: { ...state, modifiers },
        effects: [baseFx(state, 'rat_infestation', 'morale', -2, 'ネズミが備蓄を荒らしている')],
      }
    },
  },
  {
    id: 'insomnia',
    name: '集団不眠',
    tone: 'threat',
    when: (c) => c.day >= 9 && c.state.resources.morale < 50,
    weight: () => 0.2,
    mutate: (state) => {
      const M = BALANCE.modifier.insomnia
      const modifiers = addModifier(state.modifiers, {
        id: 'insomnia',
        daysLeft: M.days,
        startDay: state.day,
        effects: [{ target: 'produce:all', op: 'mult', value: M.mult }],
      })
      return {
        state: { ...state, modifiers },
        effects: [baseFx(state, 'insomnia', 'morale', -2, 'ストレスで眠れない住民が増えた')],
      }
    },
  },

  {
    id: 'aftershock',
    name: '余震',
    tone: 'threat',
    when: (c) => c.day >= 8 && c.state.resources.food < 60,
    weight: () => 0.35,
    mutate: (state) => {
      const M = BALANCE.modifier.aftershock
      const modifiers = addModifier(state.modifiers, {
        id: 'aftershock',
        daysLeft: M.lockDays,
        startDay: state.day,
        effects: [{ target: 'produce:restore_road', op: 'set', value: 0 }],
      })
      return {
        state: { ...state, modifiers },
        effects: [
          baseFx(state, 'aftershock', 'food', -15, '余震で搬入路が再び塞がれた'),
          baseFx(state, 'aftershock', 'morale', -5, '余震に恐怖が広がった'),
        ],
      }
    },
  },
  {
    id: 'second_wave',
    name: '感染症の第2波',
    tone: 'threat',
    when: (c) => c.day >= 12 && c.state.resources.medical < 25,
    weight: () => 0.35,
    mutate: (state) => {
      const present = state.units.filter(
        (u) => u.expedition === undefined && u.condition === 'healthy',
      )
      let units = state.units
      let rng = state.rng
      const injuryFx: Effect[] = []
      if (present.length > 0) {
        const [roll, r1] = nextRandom(rng)
        rng = r1
        const idx = Math.floor(roll * present.length)
        const target = present[idx]
        if (target) {
          units = units.map((u) =>
            u.id === target.id ? { ...u, condition: 'injured' as const } : u,
          )
          injuryFx.push(
            baseFx(state, 'second_wave', 'flag:injury', 0, `${target.name}が感染症で倒れた`),
          )
        }
      }
      return {
        state: { ...state, units, rng },
        effects: [
          baseFx(state, 'second_wave', 'medical', -15, '感染症の第2波が襲った'),
          ...injuryFx,
        ],
      }
    },
  },
  {
    id: 'gratitude',
    name: '住民からの感謝',
    tone: 'boon',
    when: (c) => c.state.resources.morale >= 70,
    weight: () => 0.3,
    apply: (c) => [
      baseFx(c.state, 'gratitude', 'budget', 15, '住民が自発的に寄付を集めた'),
      baseFx(c.state, 'gratitude', 'morale', 5, '感謝の言葉に励まされた'),
      baseFx(c.state, 'gratitude', 'flag:cooperation', 1, '住民の絆が深まった'),
    ],
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
      {
        id: 'buy_stockpile',
        label: '備蓄を買う',
        desc: `予算${BALANCE.procure.budget} → 備蓄+${BALANCE.procure.stockpile}`,
        when: (c) => c.state.budget >= BALANCE.procure.budget,
        apply: (c) => [
          baseFx(c.state, 'trade_offer', 'budget', -BALANCE.procure.budget, '備蓄の代金を払った'),
          baseFx(
            c.state,
            'trade_offer',
            'stockpile',
            BALANCE.procure.stockpile,
            '備蓄を買い入れた',
          ),
        ],
      },
      {
        id: 'decline',
        label: '断る',
        apply: (c) => [baseFx(c.state, 'trade_offer', 'morale', 0, '交易を断った')],
      },
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
        apply: (c) => [
          baseFx(c.state, 'stockpile_crisis', 'morale', -5, '備蓄を温存し、不満が出た'),
        ],
      },
    ],
  },
  {
    id: 'expedition',
    name: '探索の機会',
    desc: `誰かを選んで探索に出す。備蓄${BALANCE.expedition.cost}を消費。最短${BALANCE.expedition.minDays}日後から毎日帰還抽選（日を追うごとに帰還率上昇）。適性が高いほど成功率が高い。負傷や死亡の危険がある。`,
    kind: 'choice',
    when: (c) =>
      c.day >= BALANCE.expedition.dayFrom &&
      c.state.stockpile >= BALANCE.expedition.cost &&
      c.state.units.length > 0 &&
      c.state.units.every((u) => u.expedition === undefined),
    weight: () => BALANCE.expedition.weight,
    perUnit: (u) => {
      const aptMax = Math.max(u.apt.labor, u.apt.tech, u.apt.medical, u.apt.charm)
      return {
        id: `send_${u.id}`,
        label: `${u.name}を行かせる`,
        desc: `最大適性 ${aptMax}`,
        when: (c) => u.expedition === undefined && c.state.stockpile >= BALANCE.expedition.cost,
        mutate: (state) => {
          const E = BALANCE.expedition
          const units = state.units.map((x) =>
            x.id === u.id ? { ...x, expedition: state.day } : x,
          )
          return {
            state: { ...state, units },
            effects: [
              baseFx(
                state,
                'expedition',
                'stockpile',
                -E.cost,
                `${u.name}を探索に送り出した（備蓄を消費）`,
              ),
            ],
          }
        },
      }
    },
    choices: [
      {
        id: 'skip',
        label: '見送る',
        apply: (c) => [baseFx(c.state, 'expedition', 'morale', 0, '探索を見送った')],
      },
    ],
  },
]
