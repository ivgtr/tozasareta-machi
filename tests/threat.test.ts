import { describe, expect, it } from 'vitest'
import { createInitialState } from '../src/game/state'
import { determineAutoEvent } from '../src/game/events'
import { EVENTS } from '../src/game/data/events-data'
import { BALANCE } from '../src/game/data/balance'
import { actOf, slackCount, threatLevel, threatWeightMult } from '../src/game/threat'
import type { GameState } from '../src/game/types'

const THREAT_IDS = new Set([
  'elderly_illness',
  'generator_failure',
  'road_collapse',
  'ration_protest',
  'infection',
  'protest',
  'water_shortage',
  'theft',
  'elder_death',
  'wildlife',
  'landslide_warning',
  'typhoon',
  'storage_flood',
  'generator_overheat',
  'landslide_actual',
  'food_spoilage',
  'cold_snap',
  'rumor',
  'rat_infestation',
  'insomnia',
  'aftershock',
  'second_wave',
])

const BOON_IDS = new Set([
  'hidden_stockpile',
  'foraging',
  'power_restored',
  'medical_donation',
  'volunteers',
  'rescue_contact',
  'radio_repair',
  'childbirth',
  'clear_weather',
  'manna',
  'supply_drop',
  'hot_spring',
  'miracle_harvest',
  'sunny_stretch',
  'animal_trap',
  'traveling_engineer',
  'volunteer_surge',
  'clean_water',
  'cached_fuel',
  'gratitude',
])

const base = (): GameState => createInitialState(3)

const scarce = (): GameState => {
  const s = base()
  return {
    ...s,
    resources: { food: 10, power: 0, medical: 0, morale: 0 },
    stockpile: 0,
  }
}

describe('tone 分類', () => {
  it('自動イベントはすべて docs/20 §2.2 のリストどおり分類済み（arrival は対象外）', () => {
    for (const e of EVENTS) {
      if ((e.kind ?? 'auto') === 'choice') {
        expect(e.tone, e.id).toBeUndefined()
        continue
      }
      if (e.id === 'arrival') {
        expect(e.tone).toBeUndefined()
        continue
      }
      const inThreat = THREAT_IDS.has(e.id)
      const inBoon = BOON_IDS.has(e.id)
      expect(inThreat || inBoon, `unclassified: ${e.id}`).toBe(true)
      expect(inThreat && inBoon, `both: ${e.id}`).toBe(false)
      expect(e.tone, e.id).toBe(inThreat ? 'threat' : 'boon')
    }
  })

  it('分類表に実在しないイベントidが含まれない', () => {
    const ids = new Set(EVENTS.map((e) => e.id))
    for (const id of [...THREAT_IDS, ...BOON_IDS]) expect(ids.has(id), id).toBe(true)
  })

  it('threat は約20件・boon は約20件で、boon の逆転の芽を潰さない構成', () => {
    expect(THREAT_IDS.size).toBeGreaterThanOrEqual(20)
    expect(BOON_IDS.size).toBeGreaterThanOrEqual(20)
  })
})

describe('actOf', () => {
  it('1–10日がアクト1、11–20日がアクト2、21日以降がアクト3', () => {
    expect(actOf(1)).toBe(1)
    expect(actOf(10)).toBe(1)
    expect(actOf(11)).toBe(2)
    expect(actOf(20)).toBe(2)
    expect(actOf(21)).toBe(3)
    expect(actOf(30)).toBe(3)
    expect(actOf(BALANCE.days)).toBe(3)
  })
})

describe('slackCount', () => {
  const foodNeed = (s: GameState) =>
    s.units.length * BALANCE.unit.foodPerUnit * BALANCE.threat.slack.foodDays

  it('初期状態はまだ真の余裕がなく slack 0', () => {
    expect(slackCount(base())).toBe(0)
  })

  it('各条件が独立に +1 される', () => {
    const s = scarce()
    const T = BALANCE.threat.slack
    expect(slackCount(s)).toBe(0)
    expect(slackCount({ ...s, resources: { ...s.resources, food: foodNeed(s) } })).toBe(1)
    expect(slackCount({ ...s, resources: { ...s.resources, power: T.powerAt } })).toBe(1)
    expect(slackCount({ ...s, resources: { ...s.resources, medical: T.medicalAt } })).toBe(1)
    expect(slackCount({ ...s, resources: { ...s.resources, morale: T.moraleAt } })).toBe(1)
    expect(slackCount({ ...s, stockpile: T.stockpileAt })).toBe(1)
  })

  it('閾値ちょうどで slack になり、1足りなければならない', () => {
    const s = scarce()
    const T = BALANCE.threat.slack
    expect(slackCount({ ...s, resources: { ...s.resources, power: T.powerAt - 1 } })).toBe(0)
    expect(slackCount({ ...s, stockpile: T.stockpileAt - 1 })).toBe(0)
  })

  it('全条件を満たすと最大5', () => {
    const s = base()
    const full: GameState = {
      ...s,
      resources: { food: foodNeed(s) + 100, power: 100, medical: 100, morale: 100 },
      stockpile: 100,
    }
    expect(slackCount(full)).toBe(5)
  })

  it('食料の閾値は在籍人員に比例し、探索中のユニットは数えない', () => {
    const s = base()
    const food = foodNeed(s) + 10
    const many: GameState = {
      ...s,
      units: [
        ...s.units,
        ...Array.from({ length: 6 }, (_, i) => ({ ...s.units[0]!, id: `extra${i}` })),
      ],
      resources: { ...s.resources, food },
    }
    expect(slackCount(many)).toBe(0)
    const away: GameState = {
      ...many,
      units: many.units.map((u, i) => (i < 6 ? { ...u, expedition: 1 } : u)),
    }
    expect(slackCount(away)).toBe(1)
  })
})

describe('threatLevel / threatWeightMult', () => {
  it('脅威度 = アクト基底 + slack 数', () => {
    expect(threatLevel({ ...base(), day: 10 })).toBe(0)
    expect(threatLevel({ ...base(), day: 11 })).toBe(1)
    expect(threatLevel({ ...base(), day: 21 })).toBe(2)
    expect(threatLevel({ ...scarce(), day: 5 })).toBe(0)
  })

  it('スケーリング倍率 = 1 + scale×level、cap で頭打ち', () => {
    const s = scarce()
    const full: GameState = {
      ...s,
      resources: { food: 400, power: 100, medical: 100, morale: 100 },
      stockpile: 100,
    }
    expect(threatWeightMult({ ...s, day: 5 })).toBe(1)
    expect(threatWeightMult({ ...base(), day: 21 })).toBeCloseTo(
      1 + BALANCE.threat.scale * BALANCE.threat.actBase[2]!,
    )
    expect(threatWeightMult({ ...full, day: 21 })).toBe(BALANCE.threat.cap)
  })
})

describe('自動イベント抽選のスケーリング', () => {
  it('同じ状態なら同じ抽選結果（決定性）', () => {
    const s: GameState = { ...base(), day: 15 }
    expect(determineAutoEvent(s)).toEqual(determineAutoEvent(s))
  })

  it('脅威度が高いほど threat トーンの発火割合が上がる', () => {
    const high: GameState = {
      ...base(),
      day: 9,
      resources: { food: 200, power: 100, medical: 100, morale: 100 },
      stockpile: 100,
    }
    const toneOf = (id: string) => EVENTS.find((e) => e.id === id)?.tone
    const share = (root: GameState) => {
      let threat = 0
      let total = 0
      for (let i = 0; i < 400; i++) {
        const { eventId } = determineAutoEvent({ ...root, rng: { seed: 5000 + i, counter: 0 } })
        if (!eventId || toneOf(eventId) === undefined) continue
        total += 1
        if (toneOf(eventId) === 'threat') threat += 1
      }
      return threat / total
    }
    const lowShare = share({
      ...high,
      resources: { food: 10, power: 40, medical: 40, morale: 40 },
      stockpile: 0,
    })
    const highShare = share(high)
    expect(highShare).toBeGreaterThan(lowShare)
  })
})
