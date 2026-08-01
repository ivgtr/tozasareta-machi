import type { Effect, EventDef, EvalContext } from '../types'

function fx(
  ctx: EvalContext,
  id: string,
  target: Effect['target'],
  delta: number,
  reason: string,
): Effect {
  return { day: ctx.day, source: `event:${id}`, target, delta, reason }
}

export const EVENTS: EventDef[] = [
  {
    id: 'elderly_illness',
    name: '高齢者の体調不良',
    when: (c) => c.day >= 3,
    weight: (c) => 0.5 + (c.state.resources.medical < 50 ? 0.5 : 0),
    apply: (c) => [
      fx(c, 'elderly_illness', 'medical', -5, '高齢者の体調不良で医療が消費された'),
      fx(c, 'elderly_illness', 'morale', -3, '高齢者の体調不良に不安が広がった'),
    ],
  },
  {
    id: 'generator_failure',
    name: '発電機の故障',
    when: (c) => c.state.resources.power > 20,
    weight: (c) => 0.4 + (c.state.resources.power > 70 ? 0.2 : 0),
    apply: (c) => [fx(c, 'generator_failure', 'power', -25, '発電機が故障し、電力が大きく落ちた')],
  },
  {
    id: 'refugees',
    name: '隣町からの避難者',
    when: (c) => c.day >= 5,
    weight: (c) => (c.flags.refugeesAccepted === 0 ? 1 : 0.3),
    apply: (c) => [
      fx(c, 'refugees', 'food', -40, '避難者を受け入れ、食料を分け合った'),
      fx(c, 'refugees', 'morale', 4, '助け合いの空気が生まれた'),
      fx(c, 'refugees', 'flag:cooperation', 1, '避難者との協力が始まった'),
      fx(c, 'refugees', 'flag:refugeesAccepted', 1, '避難者を受け入れた'),
    ],
  },
  {
    id: 'hidden_stockpile',
    name: '隠し備蓄の発見',
    once: true,
    when: (c) => c.day >= 4,
    weight: () => 0.3,
    apply: (c) => [
      fx(c, 'hidden_stockpile', 'stockpile', 30, '商店が隠していた備蓄が見つかった'),
      fx(c, 'hidden_stockpile', 'morale', 3, '思わぬ備蓄に安堵が広がった'),
    ],
  },
  {
    id: 'road_collapse',
    name: '道路の再崩落',
    when: (c) => c.day >= 6,
    weight: () => 0.4,
    apply: (c) => [
      fx(c, 'road_collapse', 'food', -20, '豪雨で復旧中の道路が再び崩れた'),
      fx(c, 'road_collapse', 'morale', -3, '復旧作業のやり直しに落胆が広がった'),
    ],
  },
  {
    id: 'volunteers',
    name: '住民の自主協力',
    when: (c) => c.state.resources.morale >= 50,
    weight: (c) => 0.4 + c.flags.cooperation * 0.05,
    apply: (c) => [
      fx(c, 'volunteers', 'morale', 5, '住民が自主的に作業を手伝い始めた'),
      fx(c, 'volunteers', 'flag:cooperation', 1, '自主的な協力の輪が広がった'),
    ],
  },
  {
    id: 'ration_protest',
    name: '配分への反発',
    when: (c) => c.flags.daysFoodCut >= 2,
    weight: (c) => 0.5 + c.flags.daysFoodCut * 0.3,
    apply: (c) => [fx(c, 'ration_protest', 'morale', -8, '一部の住民が物資配分に反発した')],
  },
  {
    id: 'rescue_contact',
    name: '救援隊からの連絡',
    once: true,
    when: (c) => c.day >= 18 && c.day <= 26,
    weight: () => 1,
    apply: (c) => [
      fx(c, 'rescue_contact', 'morale', 15, '救援隊から「あと5日で到着」と連絡が来た'),
    ],
  },
  {
    id: 'infection',
    name: '感染症の発生',
    when: (c) => c.state.resources.medical < 30,
    weight: (c) => ((30 - c.state.resources.medical) / 30) * 2 + c.flags.daysWithoutMedical * 0.5,
    apply: (c) => [
      fx(c, 'infection', 'medical', -15, '医療を放置したため感染症が広がった'),
      fx(c, 'infection', 'morale', -10, '感染症への不安で士気が下がった'),
    ],
  },
  {
    id: 'protest',
    name: '抗議の集まり',
    when: (c) => c.state.resources.morale < 35,
    weight: (c) => ((35 - c.state.resources.morale) / 35) * 1.5,
    apply: (c) => [
      fx(c, 'protest', 'budget', -10, '抗議への対応で予算を使った'),
      fx(c, 'protest', 'morale', -5, '抗議集会が開かれた'),
    ],
  },
  {
    id: 'blackout',
    name: '大規模停電',
    when: (c) => c.state.resources.power < 40,
    weight: () => 0.4,
    apply: (c) => [
      fx(c, 'blackout', 'power', -15, '大規模な停電が起きた'),
      fx(c, 'blackout', 'morale', -4, '停電で不安が広がった'),
    ],
  },
  {
    id: 'water_shortage',
    name: '水の不足',
    when: (c) => c.day >= 8,
    weight: () => 0.3,
    apply: (c) => [
      fx(c, 'water_shortage', 'morale', -5, '水が不足し、生活が逼迫した'),
      fx(c, 'water_shortage', 'medical', -3, '水不足で衛生状態が悪化した'),
    ],
  },
  {
    id: 'theft',
    name: '窃盗事件',
    when: (c) => c.state.resources.morale < 45,
    weight: () => 0.3,
    apply: (c) => [
      fx(c, 'theft', 'stockpile', -10, '備蓄の一部が盗まれた'),
      fx(c, 'theft', 'morale', -3, '窃盗事件に不信が広がった'),
    ],
  },
  {
    id: 'radio_repair',
    name: '無線機の修復',
    once: true,
    when: (c) => c.day >= 10,
    weight: () => 0.25,
    apply: (c) => [fx(c, 'radio_repair', 'morale', 6, '無線機が修復され、外部と連絡が取れた')],
  },
  {
    id: 'childbirth',
    name: '新しい命',
    once: true,
    when: (c) => c.day >= 7,
    weight: () => 0.2,
    apply: (c) => [
      fx(c, 'childbirth', 'morale', 8, '町で新しい命が生まれた'),
      fx(c, 'childbirth', 'flag:cooperation', 1, '命をめぐり住民が協力した'),
    ],
  },
  {
    id: 'elder_death',
    name: '高齢者の死去',
    when: (c) => c.state.resources.medical < 40,
    weight: (c) => 0.3 + c.flags.daysWithoutMedical * 0.2,
    apply: (c) => [
      fx(c, 'elder_death', 'flag:casualties', 1, '高齢者が亡くなった'),
      fx(c, 'elder_death', 'morale', -6, '死を悼む空気が広がった'),
    ],
  },
  {
    id: 'trader',
    name: '行商人の来訪',
    when: (c) => c.day >= 6,
    weight: () => 0.3,
    apply: (c) => [
      fx(c, 'trader', 'budget', 25, '行商人との取引で予算を得た'),
      fx(c, 'trader', 'morale', 2, '行商人が外の 소식을伝えてくれた'),
    ],
  },
  {
    id: 'wildlife',
    name: '野生動物の出没',
    when: (c) => c.day >= 9,
    weight: () => 0.2,
    apply: (c) => [
      fx(c, 'wildlife', 'food', -10, '野生動物が食料を荒らした'),
      fx(c, 'wildlife', 'morale', -2, '野生動物の出没に不安が広がった'),
    ],
  },
  {
    id: 'clear_weather',
    name: '天候の回復',
    when: (c) => c.day >= 5,
    weight: () => 0.35,
    apply: (c) => [fx(c, 'clear_weather', 'morale', 5, '天候が回復し、空が晴れ渡った')],
  },
  {
    id: 'landslide_warning',
    name: '土砂災害警戒',
    when: (c) => c.day >= 12,
    weight: () => 0.3,
    apply: (c) => [fx(c, 'landslide_warning', 'morale', -4, '土砂災害警戒が発令された')],
  },
]
